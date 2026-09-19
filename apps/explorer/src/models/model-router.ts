import type {
    ModelProvider,
  } from './model-provider.js';
  
  export interface ModelRouter {
    cheap:
      ModelProvider;
  
    complex:
      ModelProvider;
  }
  
  export function createModelRouter(
    provider:
      ModelProvider,
  ): ModelRouter {
    return {
      cheap:
        provider,
  
      complex:
        provider,
    };
  }