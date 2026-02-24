import { z } from 'zod/v3';
import { filterMap } from '../../../util/filter-map.ts';
import { Yaml } from '../../../util/schema-utils/index.ts';
import { parseStep } from './utils.ts';

export const BitriseFile = Yaml.pipe(
  z
    .object({
      default_step_lib_source: z.string().optional(),
      workflows: z
        .record(
          z
            .object({
              steps: z
                .array(z.record(z.unknown()).transform((x) => Object.keys(x)))
                .transform((steps) => steps.flat()),
            })
            .transform(({ steps }) => steps),
        )
        .transform((x) => Object.values(x).flat()),
    })
    .transform(({ default_step_lib_source: defaultRegistry, workflows }) =>
      filterMap(workflows, (workflow) => parseStep(workflow, defaultRegistry)),
    ),
);
