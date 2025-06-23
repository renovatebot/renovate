import { z } from 'zod';
import { LooseArray, Yaml } from '../../../util/schema-utils';

export const CloudbuildSteps = Yaml.pipe(
  z
    .object({
      steps: LooseArray(
        z.object({ name: z.string() }).transform(({ name }) => name),
      ),
    })
    .transform(({ steps }) => steps),
);
