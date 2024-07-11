import {z} from 'zod';

// https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28#get-repository-content
const GithubResponseMetadata = z.object({
  name: z.string(),
  path: z.string(),
  url: z.string(),
});

// if the file is inside a directory content list it does not have an encoding or content field.
// This is the case if RAW is requested as the upstream Github URL reader does.
export const GithubFile = GithubResponseMetadata.extend({
  type: z.literal('file'),
  // content: z.string().nullable(),
  // encoding: z.string().nullable(),
});

// contains
export type GithubFile = z.infer<typeof GithubFile>;

export const GithubDirectory = GithubResponseMetadata.extend({
  type: z.literal('dir'),
});

export type GithubDirectory = z.infer<typeof GithubDirectory>;

export const GithubOtherContent = GithubResponseMetadata.extend({
  type: z.literal('symlink').or(z.literal('submodule')),
});

export type GithubOtherContent = z.infer<typeof GithubOtherContent>;

export const GithubElement = GithubFile.or(
  GithubDirectory,
).or(GithubOtherContent);
export type GithubElement = z.infer<typeof GithubElement>;

export const GithubDirectoryResponse = z.array(GithubElement);

