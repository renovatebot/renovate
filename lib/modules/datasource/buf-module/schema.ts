import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

/**
 * A single commit from the legacy BSR RepositoryCommitService.
 *
 * https://github.com/bufbuild/buf/blob/v1.73.0/proto/buf/alpha/registry/v1alpha1/repository_commit.proto
 *
 * `name` is the 32-hex commit reference users pin in `buf.lock` (field `id` is
 * an internal UUID, deliberately ignored). `b5Digest` is the ready-to-use
 * `b5:<hex>` module digest string.
 */
const RepositoryCommit = z.object({
  name: z.string(),
  createTime: z.string().optional(),
  b5Digest: z.string().optional(),
});

export const ListRepositoryCommitsByReferenceResponse = z.object({
  repositoryCommits: LooseArray(RepositoryCommit),
});

export const GetRepositoryCommitByReferenceResponse = z.object({
  repositoryCommit: RepositoryCommit,
});
