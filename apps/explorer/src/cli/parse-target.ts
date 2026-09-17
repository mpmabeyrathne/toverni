import { explorationJobSchema } from '../contracts/exploration-job.js';

export function parseTargetUrl(args: string[]) {
  const targetUrl = args[0];

  return explorationJobSchema.parse({
    targetUrl,
  });
}