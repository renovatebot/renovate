import { z } from 'zod';
import { regEx } from '../../../util/regex';
import { Yaml } from '../../../util/schema-utils';

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
