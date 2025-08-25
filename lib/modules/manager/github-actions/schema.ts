import { z } from 'zod';
import {
  LooseArray,
  LooseRecord,
  Yaml,
  withDebugMessage,
} from '../../../util/schema-utils';

const Steps = z.object({
  uses: z.string(),
  with: LooseRecord(
    z.union([z.string(), z.number().transform((s) => s.toString())]),
  ),
});
export type Steps = z.infer<typeof Steps>;

const WorkFlowJobs = z.object({
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
      steps: LooseArray(Steps).catch([]),
    }),
  ),
});

const Actions = z.object({
  runs: z.object({
    using: z.string(),
    steps: LooseArray(Steps).optional().catch([]),
  }),
});
export const Workflow = Yaml.pipe(
  z.union([WorkFlowJobs, Actions, z.null()]),
).catch(withDebugMessage(null, 'Does not match schema'));
