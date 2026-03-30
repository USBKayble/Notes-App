import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatWithMistral } from '../mistral';
import { AppSettings } from '@/hooks/useSettings';

// Mock config to return empty string for API key by default
vi.mock('../config', () => ({
  config: { mistralApiKey: '' }
}));

const mockStream = vi.fn();

// Mock the Mistral module correctly based on memory guidance
vi.mock('@mistralai/mistralai', () => {
  return {
    Mistral: class {
      chat = {
        stream: mockStream
      };
      constructor() {}
    }
  };
});

describe('chatWithMistral', () => {
  let mockSettings: AppSettings;
  let onChunkMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSettings = {
      selectedModel: 'mistral-large-latest',
      aiFeatures: {} as any
    } as unknown as AppSettings;

    onChunkMock = vi.fn();
  });

  it('should throw an error if API key is missing', async () => {
    await expect(
      chatWithMistral([], 'current doc', mockSettings, onChunkMock)
    ).rejects.toThrow("API Key missing");
  });

  describe('with valid API key', () => {
    beforeEach(async () => {
      // Set a dummy API key for these tests so getMistralClient succeeds
      const { config } = await import('../config');
      config.mistralApiKey = 'dummy_key';
    });

    it('should correctly process a basic stream without tool calls and call onChunk', async () => {
      // Create an async generator to mock the stream
      async function* generateMockStream() {
        yield { data: { choices: [{ delta: { content: 'Hello' } }] } };
        yield { data: { choices: [{ delta: { content: ' World' } }] } };
        yield { data: { choices: [{ delta: {} }] } }; // Simulate end
      }

      mockStream.mockResolvedValueOnce(generateMockStream());

      const result = await chatWithMistral([], 'current doc', mockSettings, onChunkMock);

      expect(result).toBe('Hello World');
      expect(onChunkMock).toHaveBeenCalledTimes(2);
      expect(onChunkMock).toHaveBeenNthCalledWith(1, 'Hello');
      expect(onChunkMock).toHaveBeenNthCalledWith(2, 'Hello World');
      expect(mockStream).toHaveBeenCalledTimes(1);
    });

    it('should correctly handle the read_active_note tool call and recursive call', async () => {
      // First call stream response with a tool call
      async function* generateToolCallStream() {
        yield {
          data: {
            choices: [{
              delta: {
                toolCalls: [{
                  index: 0,
                  id: 'call_123',
                  function: { name: 'read_active_note', arguments: '{}' }
                }]
              }
            }]
          }
        };
      }

      // Second call stream response (recursive)
      async function* generateFinalStream() {
        yield { data: { choices: [{ delta: { content: 'This is based on your doc' } }] } };
      }

      mockStream
        .mockResolvedValueOnce(generateToolCallStream())
        .mockResolvedValueOnce(generateFinalStream());

      const result = await chatWithMistral([], 'current note content', mockSettings, onChunkMock);

      expect(result).toBe('This is based on your doc');
      expect(mockStream).toHaveBeenCalledTimes(2);

      // Ensure the second call has the tool response in its messages
      const secondCallArgs = mockStream.mock.calls[1][0];
      const messages = secondCallArgs.messages;
      const toolMessage = messages[messages.length - 1];

      expect(toolMessage).toEqual({
        role: 'tool',
        name: 'read_active_note',
        content: 'current note content',
        toolCallId: 'call_123'
      });

      expect(onChunkMock).toHaveBeenCalledWith('This is based on your doc');
    });

    it('should correctly handle the write_active_note tool call and append <updated_note> tag', async () => {
      // First call stream response with a tool call
      async function* generateToolCallStream() {
        yield {
          data: {
            choices: [{
              delta: {
                toolCalls: [{
                  index: 0,
                  id: 'call_write_456',
                  function: { name: 'write_active_note', arguments: '{"content": "# New Document Title\\nThis is the new content"}' }
                }]
              }
            }]
          }
        };
      }

      // Second call stream response (recursive)
      async function* generateFinalStream() {
        yield { data: { choices: [{ delta: { content: 'I have updated your note.' } }] } };
      }

      mockStream
        .mockResolvedValueOnce(generateToolCallStream())
        .mockResolvedValueOnce(generateFinalStream());

      const result = await chatWithMistral([], 'old content', mockSettings, onChunkMock);

      const expectedFinalAnswer = 'I have updated your note.';
      const expectedMagicTag = '\n\n<updated_note># New Document Title\nThis is the new content</updated_note>';
      const expectedFullResult = expectedFinalAnswer + expectedMagicTag;

      expect(result).toBe(expectedFullResult);
      expect(mockStream).toHaveBeenCalledTimes(2);

      // Ensure the second call has the tool response in its messages
      const secondCallArgs = mockStream.mock.calls[1][0];
      const messages = secondCallArgs.messages;
      const toolMessage = messages[messages.length - 1];

      expect(toolMessage).toEqual({
        role: 'tool',
        name: 'write_active_note',
        content: 'Note updated successfully.',
        toolCallId: 'call_write_456'
      });

      expect(onChunkMock).toHaveBeenCalledWith(expectedFullResult);
    });

    it('should correctly handle the replace_text tool call for a successful replacement', async () => {
      async function* generateToolCallStream() {
        yield {
          data: {
            choices: [{
              delta: {
                toolCalls: [{
                  index: 0,
                  id: 'call_replace_789',
                  function: { name: 'replace_text', arguments: '{"target": "old text", "replacement": "new text"}' }
                }]
              }
            }]
          }
        };
      }

      async function* generateFinalStream() {
        yield { data: { choices: [{ delta: { content: 'Replaced text for you.' } }] } };
      }

      mockStream
        .mockResolvedValueOnce(generateToolCallStream())
        .mockResolvedValueOnce(generateFinalStream());

      const initialDoc = 'This is the old text in the document.';
      const result = await chatWithMistral([], initialDoc, mockSettings, onChunkMock);

      const expectedFinalAnswer = 'Replaced text for you.';
      const expectedNewDoc = 'This is the new text in the document.';
      const expectedMagicTag = `\n\n<updated_note>${expectedNewDoc}</updated_note>`;
      const expectedFullResult = expectedFinalAnswer + expectedMagicTag;

      expect(result).toBe(expectedFullResult);

      // Ensure the second call has the successful tool response
      const secondCallArgs = mockStream.mock.calls[1][0];
      const messages = secondCallArgs.messages;
      const toolMessage = messages[messages.length - 1];

      expect(toolMessage).toEqual({
        role: 'tool',
        name: 'replace_text',
        content: 'Replacement successful.',
        toolCallId: 'call_replace_789'
      });

      expect(onChunkMock).toHaveBeenCalledWith(expectedFullResult);
    });

    it('should correctly handle the replace_text tool call when target text is not found', async () => {
      async function* generateToolCallStream() {
        yield {
          data: {
            choices: [{
              delta: {
                toolCalls: [{
                  index: 0,
                  id: 'call_replace_err',
                  function: { name: 'replace_text', arguments: '{"target": "missing text", "replacement": "new text"}' }
                }]
              }
            }]
          }
        };
      }

      async function* generateFinalStream() {
        yield { data: { choices: [{ delta: { content: 'Could not find the text.' } }] } };
      }

      mockStream
        .mockResolvedValueOnce(generateToolCallStream())
        .mockResolvedValueOnce(generateFinalStream());

      const initialDoc = 'This document has no missing string.';
      const result = await chatWithMistral([], initialDoc, mockSettings, onChunkMock);

      expect(result).toBe('Could not find the text.');

      const secondCallArgs = mockStream.mock.calls[1][0];
      const messages = secondCallArgs.messages;
      const toolMessage = messages[messages.length - 1];

      expect(toolMessage).toEqual({
        role: 'tool',
        name: 'replace_text',
        content: 'Error: Target text not found in document.',
        toolCallId: 'call_replace_err'
      });
    });
  });
});
