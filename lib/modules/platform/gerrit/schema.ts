import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

/**
 * The Schemas for the Gerrit API Responses ({@link https://gerrit-review.googlesource.com/Documentation/rest-api.html | REST-API})
 * minimized to only needed properties.
 *
 * @packageDocumentation
 */

export const GerritAccountInfo = z.object({
  _account_id: z.number(),
  username: z.string().optional(),
});
export type GerritAccountInfo = z.infer<typeof GerritAccountInfo>;

export const GerritLabelInfo = z.object({
  approved: GerritAccountInfo.optional(),
  rejected: GerritAccountInfo.optional(),
  blocking: z.boolean().optional(),
});
export type GerritLabelInfo = z.infer<typeof GerritLabelInfo>;

export const GerritActionInfo = z.object({
  method: z.string().optional(),
  enabled: z.boolean().optional(),
});
export type GerritActionInfo = z.infer<typeof GerritActionInfo>;

export const GerritRevisionInfo = z.object({
  uploader: GerritAccountInfo,
  ref: z.string(),
  created: z.string(),
  actions: z.record(z.string(), GerritActionInfo).optional(),
  commit_with_footers: z.string().optional(),
});
export type GerritRevisionInfo = z.infer<typeof GerritRevisionInfo>;

export const GerritChangeMessageInfo = z.object({
  id: z.string(),
  message: z.string(),
  tag: z.string().optional(),
});
export type GerritChangeMessageInfo = z.infer<typeof GerritChangeMessageInfo>;

export const GerritChange = z.object({
  branch: z.string(),
  change_id: z.string(),
  subject: z.string(),
  status: z.enum(['NEW', 'MERGED', 'ABANDONED']),
  created: z.string(),
  hashtags: z.array(z.string()),
  submittable: z.boolean().optional(),
  _number: z.number(),
  labels: z.record(z.string(), GerritLabelInfo).optional(),
  reviewers: z
    .object({
      REVIEWER: LooseArray(GerritAccountInfo).optional(),
    })
    .optional(),
  messages: LooseArray(GerritChangeMessageInfo).optional(),
  current_revision: z.string().optional(),
  revisions: z.record(z.string(), GerritRevisionInfo).optional(),
  problems: z.array(z.unknown()).optional(),
  _more_changes: z.boolean().optional(),
});
export type GerritChange = z.infer<typeof GerritChange>;

export const GerritChanges = LooseArray(GerritChange);

export const GerritLabelTypeInfo = z.object({
  values: z.record(z.coerce.number(), z.string()),
  default_value: z.number(),
});
export type GerritLabelTypeInfo = z.infer<typeof GerritLabelTypeInfo>;

export const GerritProjectInfo = z.object({
  id: z.string(),
  name: z.string(),
  state: z.enum(['ACTIVE', 'READ_ONLY', 'HIDDEN']).optional(),
  labels: z.record(z.string(), GerritLabelTypeInfo).optional(),
});
export type GerritProjectInfo = z.infer<typeof GerritProjectInfo>;

export const GerritBranchInfo = z.object({
  ref: z.string(),
  revision: z.string(),
});
export type GerritBranchInfo = z.infer<typeof GerritBranchInfo>;

export const GerritMergeableInfo = z.object({
  submit_type: z.enum([
    'MERGE_IF_NECESSARY',
    'FAST_FORWARD_ONLY',
    'REBASE_IF_NECESSARY',
    'REBASE_ALWAYS',
    'MERGE_ALWAYS',
    'CHERRY_PICK',
  ]),
  mergeable: z.boolean(),
});
export type GerritMergeableInfo = z.infer<typeof GerritMergeableInfo>;

export const GerritRepos = z.record(z.string(), z.object({}).loose());

export const GerritChangeMessages = LooseArray(GerritChangeMessageInfo);
