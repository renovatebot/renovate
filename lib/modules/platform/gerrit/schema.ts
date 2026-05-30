import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const GerritAccountInfoSchema = z.object({
  _account_id: z.number(),
  username: z.string().optional(),
});

export const GerritLabelInfoSchema = z.object({
  approved: GerritAccountInfoSchema.optional(),
  rejected: GerritAccountInfoSchema.optional(),
  blocking: z.boolean().optional(),
});

export const GerritActionInfoSchema = z.object({
  method: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const GerritRevisionInfoSchema = z.object({
  uploader: GerritAccountInfoSchema.optional(),
  ref: z.string().optional(),
  created: z.string().optional(),
  actions: z.record(z.string(), GerritActionInfoSchema).optional(),
  commit_with_footers: z.string().optional(),
});

export const GerritChangeMessageInfoSchema = z.object({
  id: z.string().optional(),
  message: z.string(),
  tag: z.string().optional(),
});

export const GerritChangeSchema = z.object({
  branch: z.string().optional(),
  change_id: z.string().optional(),
  subject: z.string().optional(),
  status: z.enum(['NEW', 'MERGED', 'ABANDONED']).optional(),
  created: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  submittable: z.boolean().optional(),
  _number: z.number().optional(),
  labels: z.record(z.string(), GerritLabelInfoSchema).optional(),
  reviewers: z
    .object({
      REVIEWER: LooseArray(GerritAccountInfoSchema).optional(),
    })
    .optional(),
  messages: LooseArray(GerritChangeMessageInfoSchema).optional(),
  current_revision: z.string().optional(),
  revisions: z.record(z.string(), GerritRevisionInfoSchema).optional(),
  problems: z.array(z.unknown()).optional(),
  _more_changes: z.boolean().optional(),
});

export const GerritChangesSchema = LooseArray(GerritChangeSchema);

export const GerritLabelTypeInfoSchema = z.object({
  values: z.record(z.coerce.number(), z.string()),
  default_value: z.number(),
});

export const GerritProjectInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.enum(['ACTIVE', 'READ_ONLY', 'HIDDEN']).optional(),
  labels: z.record(z.string(), GerritLabelTypeInfoSchema).optional(),
});

export const GerritBranchInfoSchema = z.object({
  ref: z.string(),
  revision: z.string(),
});

export const GerritMergeableInfoSchema = z.object({
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

export const GerritReposSchema = z.record(
  z.string(),
  z.object({}).passthrough(),
);

export const GerritChangeMessagesSchema = LooseArray(
  GerritChangeMessageInfoSchema,
);
