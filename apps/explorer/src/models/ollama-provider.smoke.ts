import {
    getModelConfiguration,
  } from '../configuration/model.js';
  
  import {
    ModelUsageTracker,
    OllamaProvider,
  } from './index.js';
  
  async function main(): Promise<void> {
    const configuration =
      getModelConfiguration();
  
    const provider =
      new OllamaProvider({
        baseUrl:
          configuration
            .OLLAMA_BASE_URL,
  
        cheapModel:
          configuration
            .OLLAMA_CHEAP_MODEL,
  
        complexModel:
          configuration
            .OLLAMA_COMPLEX_MODEL,
      });
  
    const usageTracker =
      new ModelUsageTracker();
  
    // --------------------------------
    // Cheap reasoning: state analysis
    // --------------------------------
  
    const stateAnalysis =
      await provider.analyzeState({
        url:
          'https://example.com/products',
  
        title:
          'Products',
  
        semanticText: [
          'Products',
          'Search products',
          'Add to cart',
        ],
  
        actions: [
          {
            type:
              'input',
  
            name:
              'Search products',
          },
  
          {
            type:
              'button',
  
            name:
              'Add to cart',
          },
        ],
      });
  
    usageTracker.record(
      stateAnalysis.usage,
    );
  
    console.log(
      'State analysis:',
      JSON.stringify(
        stateAnalysis,
        null,
        2,
      ),
    );
  
    // --------------------------------
    // Cheap reasoning: action ranking
    // --------------------------------
  
    const actionRanking =
      await provider.rankActions({
        stateSummary:
          stateAnalysis.data.summary,
  
        actions: [
          {
            id:
              'search-products',
  
            label:
              'Search products',
  
            type:
              'input',
  
            deterministicScore:
              80,
          },
  
          {
            id:
              'add-to-cart',
  
            label:
              'Add to cart',
  
            type:
              'button',
  
            deterministicScore:
              100,
          },
        ],
      });
  
    usageTracker.record(
      actionRanking.usage,
    );
  
    console.log(
      'Action ranking:',
      JSON.stringify(
        actionRanking,
        null,
        2,
      ),
    );
  
    // --------------------------------
    // Complex reasoning:
    // scenario generation
    // --------------------------------
  
    const scenarioGeneration =
      await provider.generateScenarios({
        applicationSummary:
          'A commerce application where users can browse products and add products to a cart.',
  
        capabilities: [
          'Browse products',
          'Search products',
          'Add products to cart',
        ],
  
        requirements: [
          'A user can search for products.',
          'A user can add an available product to the cart.',
        ],
  
        discoveredFlows: [
          'Products page → Add to cart',
        ],
      });
  
    usageTracker.record(
      scenarioGeneration.usage,
    );
  
    console.log(
      'Scenario generation:',
      JSON.stringify(
        scenarioGeneration,
        null,
        2,
      ),
    );
  
    // --------------------------------
    // Usage summary
    // --------------------------------
  
    console.log(
      'Model usage summary:',
      JSON.stringify(
        usageTracker.getSummary(),
        null,
        2,
      ),
    );
  }
  
  await main();