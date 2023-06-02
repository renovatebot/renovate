import type { z } from 'zod';
import type { HostRule } from '../../../types';
import type { DocSchema, ReleaseSchema, RepositorySchema } from './schema';

export type Release = z.infer<typeof ReleaseSchema>;

export type Repository = z.infer<typeof RepositorySchema>;

export type Doc = z.infer<typeof DocSchema>;

export interface RepositoryRule extends Repository {
  hostRule: HostRule;
}
