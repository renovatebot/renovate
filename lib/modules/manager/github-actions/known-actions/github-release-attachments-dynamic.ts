import { z } from 'zod/v4';
import { regEx } from '../../../../util/regex.ts';
import { GithubReleaseAttachmentsDatasource } from '../../../datasource/github-release-attachments/index.ts';
import type { ActionSchema, KnownActionConfig } from '../types.ts';
import { parseValue } from './utils.ts';

const sha256Regex = regEx(/^[a-f0-9]{64}$/);
const MiseWith: ActionSchema = z
  .object({
    version: z.string().optional(),
    sha256: z.string().optional(),
  })
  .transform(({ version, sha256 }) => [
    {
      ...parseValue(version),
      ...(sha256 && sha256Regex.test(sha256) ? { currentDigest: sha256 } : {}),
    },
  ]);

export const githubReleaseAttachmentsDynamicActions: Record<
  string,
  KnownActionConfig
> = {
  'jdx/mise-action': {
    datasource: GithubReleaseAttachmentsDatasource.id,
    packageName: 'jdx/mise',
    withSchema: MiseWith,
  },
};
