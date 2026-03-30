import { describe, it, expect, vi } from 'vitest';
import { fetchMistralModels, synthesizeNote } from '../mistral';
import { AppSettings } from '@/hooks/useSettings';

// Mock the config so we can test the fallback without API key
vi.mock('../config', () => ({
  config: { mistralApiKey: '' }
}));

const { mockList, mockComplete } = vi.hoisted(() => ({
  mockList: vi.fn().mockRejectedValue(new Error('Network error')),
  mockComplete: vi.fn()
}));

// Mock the Mistral module correctly
vi.mock('@mistralai/mistralai', () => {
  return {
    Mistral: class {
      models = {
        list: mockList
      };
      chat = {
        complete: mockComplete
      };
      constructor() {}
    }
  };
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

  it('should return an empty array if no API key is provided and config lacks one', async () => {
    const models = await fetchMistralModels();
    expect(models).toEqual([]);
  });
});

describe('synthesizeNote', () => {
  const mockSettings = {
    selectedModel: "mistral-large-latest"
  } as AppSettings;

  it('should return the integrated content when API succeeds', async () => {
    // We need to provide a dummy api key to getMistralClient so it returns a client
    const { config } = await import('../config');
    config.mistralApiKey = 'dummy';

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
