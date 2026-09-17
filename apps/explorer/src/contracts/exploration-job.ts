import { z } from 'zod';

export const explorationJobSchema = z.object({
  targetUrl: z.url(),
});

export type ExplorationJob = z.infer<typeof explorationJobSchema>;