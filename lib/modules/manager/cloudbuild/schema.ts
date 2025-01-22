import { z } from 'zod';
import { LooseArray, Yaml } from '../../../util/schema-utils';
import { getDep } from '../dockerfile/extract';

export const CloudbuildSteps = Yaml.pipe(
  z
    .object({
      steps: LooseArray(
        z.object({ name: z.string() }).transform(({ name }) => getDep(name)),
      ),
    })
    .transform(({ steps }) => steps),
);
