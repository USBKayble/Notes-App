import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMistralModels, synthesizeNote, mediaUnderstanding, transcribeAndCleanup, textToSpeech } from '../mistral';
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

describe('textToSpeech', () => {
  const mockSettings: AppSettings = {
    mistralApiKey: 'test_api_key',
    githubRepo: 'test/repo',
    selectedModel: 'mistral-large-latest',
    aiFeatures: {
      transcription: { state: 'off', model: 'voxtral-mini-2507', cleanupModel: 'mistral-small-latest', grammarModel: 'mistral-small-latest' },
      grammar: { state: 'suggest', model: 'mistral-small-latest' },
      organization: { state: 'off', model: 'mistral-small-latest' },
      summarization: { state: 'suggest', model: 'mistral-large-latest' },
      media: { state: 'apply', model: 'pixtral-12b-2409', ocrModel: 'mistral-ocr-latest' },
      tts: { state: 'on', model: 'voxtral-mini-tts-2603', voiceId: 'test-voice', savedVoices: [] }
    },
    editorFont: 'Inter'
  };

  let originalFetch: typeof fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should return null if API key is missing', async () => {
    const settingsNoKey = { ...mockSettings, mistralApiKey: '' };
    const result = await textToSpeech('Hello world', settingsNoKey);
    expect(result).toBeNull();
  });

  it('should use valid TTS model and return blob URL on success', async () => {
    const mockHeaders = new Map([["content-type", "audio/mpeg"]]);
    const mockResponse = {
      ok: true,
      headers: {
        get: (key: string) => mockHeaders.get(key) || null
      },
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await textToSpeech('Hello world', mockSettings);

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body as string);
    expect(body.model).toBe('voxtral-mini-tts-2603');
    expect(body.input).toBe('Hello world');
    expect(body.voice_id).toBe('test-voice');
    expect(body.response_format).toBe('mp3');
    expect(result).toBeTruthy();
    expect(result).toContain('blob:');
  });

  it('should return null and log error on API failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockResponse = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: vi.fn().mockResolvedValue(JSON.stringify({ object: 'error', message: 'Invalid model: voxtral-mini-tts-2603', type: 'invalid_model' }))
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await textToSpeech('Hello world', mockSettings);

    expect(consoleSpy).toHaveBeenCalledWith('TTS request failed:', 400, 'Bad Request');
    expect(consoleSpy).toHaveBeenCalledWith('TTS error response:', expect.stringContaining('Invalid model'));
    expect(result).toBeNull();

    consoleSpy.mockRestore();
  });

  it('should return null and log error on network failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await textToSpeech('Hello world', mockSettings);

    expect(consoleSpy).toHaveBeenCalledWith('TTS failed', expect.any(Error));
    expect(result).toBeNull();

    consoleSpy.mockRestore();
  });

  it('should fallback to default model when invalid model stored', async () => {
    const settingsWithInvalidModel: AppSettings = {
      ...mockSettings,
      aiFeatures: {
        ...mockSettings.aiFeatures,
        tts: { state: 'on', model: 'invalid-model-xyz', voiceId: 'test-voice', savedVoices: [] }
      }
    };
    const mockHeaders = new Map([["content-type", "audio/mpeg"]]);
    const mockResponse = {
      ok: true,
      headers: {
        get: (key: string) => mockHeaders.get(key) || null
      },
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    await textToSpeech('Hello world', settingsWithInvalidModel);

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body as string);
    expect(body.model).toBe('voxtral-mini-tts-2603');
  });

  it('should use default voice when voice_id is empty', async () => {
    const settingsNoVoice: AppSettings = {
      ...mockSettings,
      aiFeatures: {
        ...mockSettings.aiFeatures,
        tts: { state: 'on', model: 'voxtral-mini-tts-2603', voiceId: '', savedVoices: [] }
      }
    };
    const mockHeaders = new Map([["content-type", "audio/mpeg"]]);
    const mockResponse = {
      ok: true,
      headers: {
        get: (key: string) => mockHeaders.get(key) || null
      },
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    await textToSpeech('Hello world', settingsNoVoice);

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body as string);
    expect(body.voice_id).toBe('');
  });
});
