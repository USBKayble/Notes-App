import { describe, it, expect, vi, beforeEach } from 'vitest';
import { summarizeHighlight } from '../mistral';
import { AppSettings } from '../../hooks/useSettings';

const mockComplete = vi.fn();

// Mock the Mistral client
vi.mock('@mistralai/mistralai', () => {
  return {
    Mistral: class {
      chat = {
        complete: mockComplete
      };
      constructor() {}
    }
  };
});

describe('summarizeHighlight', () => {
  let mockSettings: AppSettings;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSettings = {
      mistralApiKey: 'dummy_key',
      aiFeatures: {
        summarization: {
          model: 'mistral-large-latest',
          state: 'apply'
        }
      }
    } as unknown as AppSettings;
  });

  it('should return the text unchanged if API throws an error', async () => {
    mockComplete.mockRejectedValue(new Error('API Error'));
    const result = await summarizeHighlight('original text', mockSettings);
    expect(result).toBe('original text');
  });

  it('should return summary with [!SUMM] correctly if the model includes it', async () => {
    mockComplete.mockResolvedValue({
      choices: [
        {
          message: {
            content: '> [!SUMM]\n> - Bullet 1\n> - Bullet 2'
          }
        }
      ]
    });

    const result = await summarizeHighlight('original text', mockSettings);
    expect(result).toBe('> [!SUMM]\n> - Bullet 1\n> - Bullet 2\n\noriginal text');
  });

  it('should manually add [!SUMM] and blockquote if model response lacks it', async () => {
    mockComplete.mockResolvedValue({
      choices: [
        {
          message: {
            content: '- Bullet 1\n- Bullet 2'
          }
        }
      ]
    });

    const result = await summarizeHighlight('original text', mockSettings);
    expect(result).toBe('> [!SUMM]\n> - Bullet 1\n> - Bullet 2\n\noriginal text');
  });

  it('should strip markdown code blocks and manually add [!SUMM] and blockquote if missing', async () => {
    mockComplete.mockResolvedValue({
      choices: [
        {
          message: {
            content: '```markdown\n- Bullet 1\n- Bullet 2\n```'
          }
        }
      ]
    });

    const result = await summarizeHighlight('original text', mockSettings);
    expect(result).toBe('> [!SUMM]\n> - Bullet 1\n> - Bullet 2\n\noriginal text');
  });

  it('should strip generic code blocks and manually add [!SUMM] and blockquote if missing', async () => {
    mockComplete.mockResolvedValue({
      choices: [
        {
          message: {
            content: '```\n- Bullet 1\n- Bullet 2\n```'
          }
        }
      ]
    });

    const result = await summarizeHighlight('original text', mockSettings);
    expect(result).toBe('> [!SUMM]\n> - Bullet 1\n> - Bullet 2\n\noriginal text');
  });

  it('should return empty summary manually wrapped if content is not string', async () => {
    mockComplete.mockResolvedValue({
      choices: [
        {
          message: {
            content: null
          }
        }
      ]
    });

    const result = await summarizeHighlight('original text', mockSettings);
    // When content is null, it falls back to empty string.
    // split('\n') on empty string is [''], joined with '\n> ' is ''
    // So the result should be '> [!SUMM]\n> \n\noriginal text'
    expect(result).toBe('> [!SUMM]\n> \n\noriginal text');
  });
});
