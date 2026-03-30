import { describe, it, expect, vi } from 'vitest';
import { fetchMistralModels } from '../mistral';

// Mock the config so we can test the fallback without API key
vi.mock('../config', () => ({
  config: { mistralApiKey: '' }
}));

// Mock the Mistral module correctly
vi.mock('@mistralai/mistralai', () => {
  return {
    Mistral: class {
      models = {
        list: vi.fn().mockRejectedValue(new Error('Network error'))
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
