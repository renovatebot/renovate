import { z } from 'zod/v4';

const ContentsCommon = z.object({
  name: z.string(),
  path: z.string(),
});

const ContentsFile = ContentsCommon.extend({
  type: z.literal('file'),
  content: z.string().nullable(),
});

const ContentsDir = ContentsCommon.extend({ type: z.literal('dir') });
const ContentsSymlink = ContentsCommon.extend({ type: z.literal('symlink') });
const ContentsSubmodule = ContentsCommon.extend({
  type: z.literal('submodule'),
});

export const RepoContents = z.discriminatedUnion('type', [
  ContentsFile,
  ContentsDir,
  ContentsSymlink,
  ContentsSubmodule,
]);
export type RepoContents = z.infer<typeof RepoContents>;

export const ContentsListResponse = z.array(RepoContents);
