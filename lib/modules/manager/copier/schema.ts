import { z } from 'zod';
import { Yaml } from '../../../util/schema-utils';

export const CopierAnswersFile = Yaml.pipe(
  z.object({
    _commit: z.string(),
    _src_path: z.string().url(),
  }),
);

export type CopierAnswersFile = z.infer<typeof CopierAnswersFile>;
