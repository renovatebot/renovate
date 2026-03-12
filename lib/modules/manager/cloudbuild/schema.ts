import { z } from 'zod/v3';
import { LooseArray, Yaml } from '../../../util/schema-utils/index.ts';

export const CloudbuildSteps = Yaml.pipe(
  z
    .object({
      steps: LooseArray(
        z.object({ name: z.string() }).transform(({ name }) => name),
      ),
    })
    .transform(({ steps }) => steps),
);
