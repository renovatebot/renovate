import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const NodeReleaseSchema = z.object({
  /** node version */
  version: z.string(),
  /** release date */
  date: z.string().optional(),
  /** Is LTS release */
  lts: z.union([z.literal(false), z.string()]),
});

export type NodeReleaseSchema = z.infer<typeof NodeReleaseSchema>;

export const NodeReleasesSchema = LooseArray(NodeReleaseSchema);
