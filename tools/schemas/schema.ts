import { z } from 'zod';

const MonorepoSchema = z.object({
  repoGroups: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  orgGroups: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  patternGroups: z.record(
    z.string(),
    z.union([z.string(), z.array(z.string())]),
  ),
});

export { MonorepoSchema };
