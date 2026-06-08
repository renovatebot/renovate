import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const NodeRelease = z.object({
  /** node version */
  version: z.string(),
  /** release date */
  date: z.string().optional(),
  /** Is LTS release */
  lts: z.union([z.literal(false), z.string()]),
});

export type NodeRelease = z.infer<typeof NodeRelease>;

export const NodeReleases = LooseArray(NodeRelease);
