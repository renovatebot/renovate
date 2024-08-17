import { z } from 'zod';

const UrlSchema = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())]),
);

const MonorepoSchema = z.object({
  repoGroups: UrlSchema,
  orgGroups: UrlSchema,
  patternGroups: UrlSchema,
});

export { MonorepoSchema };
