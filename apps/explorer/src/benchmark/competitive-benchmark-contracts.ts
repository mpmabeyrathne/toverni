import type {
  BenchmarkMetrics,
  BenchmarkScenario,
} from './benchmark-contracts.js';

export interface CompetitiveToolMetadata {
  id: string;
  name: string;
  category:
    | 'toverni'
    | 'generic_llm'
    | 'ai_agent'
    | 'framework_agent';
  version: string;
  source: string;
  inputProtocol: string;
  executionBudget: string;
  notes: string[];
}

export interface CompetitiveToolFixtureOutput {
  fixtureId: string;
  scenarios: BenchmarkScenario[];
}

export interface CompetitiveFixtureMetrics {
  fixtureId: string;
  title: string;
  methods: Record<
    string,
    BenchmarkMetrics
  >;
}

export interface CompetitiveBenchmarkReport {
  generatedAt: string;
  tools: CompetitiveToolMetadata[];
  applications:
    CompetitiveFixtureMetrics[];
  aggregate:
    Record<
      string,
      BenchmarkMetrics
    >;
  toverniGatePassed:
    boolean;
  toverniFailedGates:
    string[];
  limitations:
    string[];
}
