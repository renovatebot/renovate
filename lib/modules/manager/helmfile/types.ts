import type { z } from 'zod';

import type {
  DocSchema,
  LockSchema,
  ReleaseSchema,
  RepositorySchema,
} from './schema';

export type Release = z.infer<typeof ReleaseSchema>;

export type Repository = z.infer<typeof RepositorySchema>;

export type Doc = z.infer<typeof DocSchema>;

export type Lock = z.infer<typeof LockSchema>;
