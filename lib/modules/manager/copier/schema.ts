import { z } from 'zod/v3';
import { regEx } from '../../../util/regex.ts';
import { Yaml } from '../../../util/schema-utils/index.ts';

const GitSshUrl = z.string().regex(regEx(/^[^@]+@[^:]*:.+$/), {
  message: 'Invalid Git SSH URL format',
});
export const CopierAnswersFile = Yaml.pipe(
  z.object({
    _commit: z.string(),
    _src_path: z.string().url().or(GitSshUrl),
  }),
);

export type CopierAnswersFile = z.infer<typeof CopierAnswersFile>;
