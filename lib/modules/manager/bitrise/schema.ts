import { z } from 'zod';
import { filterMap } from '../../../util/filter-map';
import { Yaml } from '../../../util/schema-utils';
import { parseStep } from './utils';

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
