import {
    z,
  } from 'zod';
  
  const modelConfigurationSchema =
    z.object({
      MODEL_REASONING_ENABLED:
        z.enum([
          'true',
          'false',
        ])
          .default('false')
          .transform(
            (value) =>
              value === 'true',
          ),

      MODEL_PROVIDER:
        z.enum([
          'ollama',
        ])
          .default(
            'ollama',
          ),

      MODEL_RETRY_ATTEMPTS:
        z.coerce
          .number()
          .int()
          .positive()
          .default(
            2,
          ),
  
      OLLAMA_BASE_URL:
        z.string()
          .url()
          .default(
            'http://127.0.0.1:11434',
          ),
  
      OLLAMA_CHEAP_MODEL:
        z.string()
          .min(1)
          .default(
            'llama3.2:3b',
          ),
  
      OLLAMA_COMPLEX_MODEL:
        z.string()
          .min(1)
          .default(
            'llama3.2:3b',
          ),
    });
  
  export function getModelConfiguration() {
    return modelConfigurationSchema.parse({
      MODEL_REASONING_ENABLED:
        process.env
          .MODEL_REASONING_ENABLED,

      MODEL_PROVIDER:
        process.env
          .MODEL_PROVIDER,

      MODEL_RETRY_ATTEMPTS:
        process.env
          .MODEL_RETRY_ATTEMPTS,
  
      OLLAMA_BASE_URL:
        process.env
          .OLLAMA_BASE_URL,
  
      OLLAMA_CHEAP_MODEL:
        process.env
          .OLLAMA_CHEAP_MODEL,
  
      OLLAMA_COMPLEX_MODEL:
        process.env
          .OLLAMA_COMPLEX_MODEL,
    });
  }