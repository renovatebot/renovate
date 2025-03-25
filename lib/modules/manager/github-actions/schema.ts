import { z } from 'zod';
import {
  LooseArray,
  LooseRecord,
  Yaml,
  withDebugMessage,
} from '../../../util/schema-utils';

const StepsSchema = z.object({
  uses: z.string(),
  with: LooseRecord(z.string()),
});
export type Steps = z.infer<typeof StepsSchema>;

const WorkFlowJobsSchema = z
  .object({
    jobs: LooseRecord(
      z.object({
        container: z
          .union([
            z.string(),
            z.object({ image: z.string() }).transform((v) => v.image),
          ])
          .optional()
          .catch(undefined),
        services: LooseRecord(
          z.union([
            z.object({ image: z.string() }).transform((v) => v.image),
            z.string(),
          ]),
        )
          .catch({})
          .transform((services) => Object.values(services)),
        'runs-on': z
          .union([z.string().transform((v) => [v]), z.array(z.string())])
          .catch([]),
        steps: LooseArray(StepsSchema).catch([]),
      }),
    ),
  })
  .transform((v) => Object.values(v.jobs));

const ActionStepsSchema = z.object({
  steps: LooseArray(StepsSchema).catch([]),
});
export const WorkflowSchema = Yaml.pipe(
  z.union([WorkFlowJobsSchema, ActionStepsSchema, z.null()]),
).catch(withDebugMessage(null, 'Does not match schema'));
