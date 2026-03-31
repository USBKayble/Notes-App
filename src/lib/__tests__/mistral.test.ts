import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMistralModels, synthesizeNote, mediaUnderstanding, transcribeAndCleanup } from '../mistral';
import { AppSettings } from '@/hooks/useSettings';

const { mockList, mockComplete, mockProcess, mockAudioComplete } = vi.hoisted(() => ({
  mockList: vi.fn().mockRejectedValue(new Error('Network error')),
  mockComplete: vi.fn(),
  mockProcess: vi.fn(),
  mockAudioComplete: vi.fn()
}));

// Mock the Mistral module correctly
vi.mock('@mistralai/mistralai', () => {
  return {
    Mistral: class {
      models = {
        list: mockList
      };
      ocr = {
        process: mockProcess
      };
      chat = {
        complete: mockComplete
      };
      audio = {
        transcriptions: {
          complete: mockAudioComplete
        }
      };
      constructor() {}
    }
  };
});

describe('transcribeAndCleanup', () => {
  const dummyBlob = new Blob(['dummy audio content'], { type: 'audio/webm' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw an error if API Key is missing', async () => {
    await expect(transcribeAndCleanup(dummyBlob, undefined)).rejects.toThrow('API Key missing');
  });

  it('should return an empty string and log an error if transcription fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Transcription API error');
    mockAudioComplete.mockRejectedValueOnce(error);

    const result = await transcribeAndCleanup(dummyBlob, 'dummy_key');

    expect(result).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith('Transcription failed', error);

    consoleSpy.mockRestore();
  });

  it('should return the raw transcription and log an error if cleanup fails', async () => {
    mockAudioComplete.mockResolvedValueOnce({ text: 'Raw transcription text' });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Cleanup API error');
    mockComplete.mockRejectedValueOnce(error);

    const result = await transcribeAndCleanup(dummyBlob, 'dummy_key');

    expect(result).toBe('Raw transcription text');
    expect(consoleSpy).toHaveBeenCalledWith('Cleanup failed', error);

    consoleSpy.mockRestore();
  });

  it('should return the cleaned up text on full success', async () => {
    mockAudioComplete.mockResolvedValueOnce({ text: 'Raw transcription text' });
    mockComplete.mockResolvedValueOnce({
      choices: [{ message: { content: 'Cleaned transcription text' } }]
    });

    const result = await transcribeAndCleanup(dummyBlob, 'dummy_key');

    expect(result).toBe('Cleaned transcription text');
    expect(mockAudioComplete).toHaveBeenCalledWith({
      file: dummyBlob as File,
      model: 'mistral-small-latest'
    });
    expect(mockComplete).toHaveBeenCalledWith({
      model: "mistral-small-latest",
      messages: [
        { role: "system", content: "Clean up transcription. Fix punctuation, spelling, remove filler words, and correct phonetic errors. Keep original tone. LaTeX: $ for inline, $$ for block. Output ONLY cleaned text." },
        { role: "user", content: 'Raw transcription text' }
      ]
    });
  });

  it('should return raw text if cleanup returns non-string content', async () => {
    mockAudioComplete.mockResolvedValueOnce({ text: 'Raw transcription text' });
    mockComplete.mockResolvedValueOnce({
      choices: [{ message: { content: null } }]
    });

    const result = await transcribeAndCleanup(dummyBlob, 'dummy_key');

    expect(result).toBe('Raw transcription text');
  });

  it('should return empty string if transcription returns empty text', async () => {
    mockAudioComplete.mockResolvedValueOnce({ text: '' });

    const result = await transcribeAndCleanup(dummyBlob, 'dummy_key');

    expect(result).toBe('');
    // Cleanup should not be called
    expect(mockComplete).not.toHaveBeenCalled();
  });
});

describe('fetchMistralModels fallback list', () => {
  it('should return the correct fallback list when API fails', async () => {
    // Supress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Provide a valid dummy key to instantiate the client
    const models = await fetchMistralModels('dummy_api_key');

    // Verify the structure and content of the fallback list
    expect(models).toEqual([
      // General Purpose
      { id: "mistral-large-latest" },
      { id: "mistral-medium-latest" },
      { id: "mistral-small-latest" },

      // Open Source / Edge
      { id: "open-mistral-7b" },
      { id: "open-mixtral-8x7b" },
      { id: "open-mixtral-8x22b" },
      { id: "open-mistral-nemo" },

      // Coding Specialist
      { id: "codestral-latest" },

      // Specialized
      { id: "mistral-embed" },
      { id: "pixtral-12b-2409" },
      { id: "mistral-ocr-latest" },

      // Ministral
      { id: "ministral-3b-latest" },
      { id: "ministral-8b-latest" },

      // Audio / Video
      { id: "voxtral-mini-2507" },

      // Moderation
      { id: "mistral-moderation-latest" }
    ]);

    expect(consoleSpy).toHaveBeenCalledWith("Failed to fetch models from Mistral API:", expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('should return an empty array if no API key is provided', async () => {
    const models = await fetchMistralModels();
    expect(models).toEqual([]);
  });
});

describe('synthesizeNote', () => {
  const mockSettings = {
    mistralApiKey: 'dummy_key',
    selectedModel: "mistral-large-latest"
  } as AppSettings;

  it('should return the integrated content when API succeeds', async () => {
    mockComplete.mockResolvedValueOnce({
      choices: [{ message: { content: 'Integrated Note' } }]
    });

    const result = await synthesizeNote('Current Note', 'New Context', 'reff.jpg', mockSettings);
    expect(result).toBe('Integrated Note');
    expect(mockComplete).toHaveBeenCalledWith({
      model: "mistral-large-latest",
      messages: [
        {
          role: "system",
          content: expect.stringContaining("Integrate 'New Information' into 'Existing Note'.")
        },
        {
          role: "user",
          content: "Existing Note:\nCurrent Note\n\nNew Information:\nNew Context"
        }
      ]
    });
  });

  it('should return fallback string when API returns non-string content', async () => {
    mockComplete.mockResolvedValueOnce({
      choices: [{ message: { content: null } }]
    });

    const result = await synthesizeNote('Current Note', 'New Context', 'reff.jpg', mockSettings);
    expect(result).toBe('Current Note\n\nNew Context');
  });

  it('should catch error, log it, and return fallback string when API fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('API Error');
    mockComplete.mockRejectedValueOnce(error);

    const result = await synthesizeNote('Current Note', 'New Context', 'reff.jpg', mockSettings);
    expect(result).toBe('Current Note\n\nNew Context [Reff: reff.jpg]');
    expect(consoleSpy).toHaveBeenCalledWith("Synthesis failed", error);

    consoleSpy.mockRestore();
  });
});

describe('mediaUnderstanding', () => {
  const mockSettings = {
    mistralApiKey: 'dummy_key',
    aiFeatures: {
      media: {
        model: 'pixtral-12b-2409',
        ocrModel: 'mistral-ocr-latest'
      }
    }
  } as AppSettings;

  let originalCreateObjectURL: typeof URL.createObjectURL;

  beforeEach(async () => {
    vi.clearAllMocks();
    originalCreateObjectURL = global.URL.createObjectURL;
  });

  afterEach(async () => {
    global.URL.createObjectURL = originalCreateObjectURL;
  });

  it('should return null if file is not an image', async () => {
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const result = await mediaUnderstanding(file, mockSettings);
    expect(result).toBeNull();
  });

  it('should process image and return MediaUnderstandingResult', async () => {
    const file = new File(['image content'], 'test.png', { type: 'image/png' });

    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:dummy-url');

    mockProcess.mockResolvedValueOnce({
      pages: [{ markdown: 'OCR text line 1' }, { markdown: 'OCR text line 2' }]
    });

    mockComplete.mockResolvedValueOnce({
      choices: [{ message: { content: 'This is an image description.' } }]
    });

    const result = await mediaUnderstanding(file, mockSettings);

    expect(mockProcess).toHaveBeenCalledWith({
      model: 'mistral-ocr-latest',
      document: {
        type: 'image_url',
        imageUrl: 'blob:dummy-url'
      }
    });

    expect(mockComplete).toHaveBeenCalledWith({
      model: 'pixtral-12b-2409',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image. Summarize documents or describe scenes/subjects. Output ONLY clean Markdown (Headers, Bullets). No code blocks.' },
            { type: 'image_url', imageUrl: 'blob:dummy-url' }
          ]
        }
      ]
    });

    expect(result).toEqual({
      description: 'This is an image description.',
      ocrMarkdown: 'OCR text line 1\nOCR text line 2',
      combined: '### Media Analysis\nThis is an image description.\n\n### OCR Result\nOCR text line 1\nOCR text line 2'
    });
  });

  it('should return description without ocrMarkdown if ocr returns no pages', async () => {
    const file = new File(['image content'], 'test.png', { type: 'image/png' });
    global.URL.createObjectURL = vi.fn(() => 'blob:dummy-url');

    mockProcess.mockResolvedValueOnce({ pages: [] });
    mockComplete.mockResolvedValueOnce({
      choices: [{ message: { content: 'No OCR.' } }]
    });

    const result = await mediaUnderstanding(file, mockSettings);

    expect(result?.ocrMarkdown).toBe('');
    expect(result?.combined).toContain('### OCR Result\n');
  });

  it('should handle API errors gracefully, log error and return null', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const file = new File(['image content'], 'test.png', { type: 'image/png' });
    global.URL.createObjectURL = vi.fn(() => 'blob:dummy-url');

    const error = new Error('API processing error');
    mockProcess.mockRejectedValueOnce(error);

    const result = await mediaUnderstanding(file, mockSettings);

    expect(consoleSpy).toHaveBeenCalledWith('Media processing failed', error);
    expect(result).toBeNull();

    consoleSpy.mockRestore();
  });
});
