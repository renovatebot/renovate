import { z } from 'zod';
import { Yaml } from '../../../util/schema-utils';

const GitSshUrl = z
  .string()
  .regex(/^git@[^:]*:(?<repository>.+)$/, {
    message: 'Invalid Git SSH URL format',
  });
export const CopierAnswersFile = Yaml.pipe(
  z.object({
    _commit: z.string(),
    _src_path: z.string().url().or(GitSshUrl),
  }),
);

export type CopierAnswersFile = z.infer<typeof CopierAnswersFile>;
