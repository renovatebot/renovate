import { z } from 'zod/v4';
import {
  LooseArray,
  LooseRecord,
  Yaml,
  withDebugMessage,
} from '../../../util/schema-utils/index.ts';

const UsesStep = z.object({
  uses: z.string(),
  with: LooseRecord(
    z.union([z.string(), z.number().transform((s) => s.toString())]),
  ),
});
export type UsesStep = z.infer<typeof UsesStep>;

// A `parallel:` group flattens its (recursively resolved) sub-steps into leaf steps.
// See: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#example-running-steps-in-parallel
const ParallelStep: z.ZodType<UsesStep[]> = z
  .object({ parallel: LooseArray(z.lazy(() => Step)) })
  .transform(({ parallel }) => parallel.flat());

// A step resolves to a flat list of `uses:` steps: a normal step yields itself,
// a `parallel:` group yields its flattened sub-steps.
const Step: z.ZodType<UsesStep[]> = z.union([
  UsesStep.transform((step) => [step]),
  ParallelStep,
]);

// Flatten the per-element `UsesStep[]` groups into a single `UsesStep[]`.
const Steps = LooseArray(Step).transform((groups) => groups.flat());

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
      steps: Steps.catch([]),
    }),
  ),
});

const Actions = z.object({
  runs: z.object({
    using: z.string(),
    steps: Steps.optional().catch([]),
  }),
});
export const Workflow = Yaml.pipe(
  z.union([WorkFlowJobs, Actions, z.null()]),
).catch(withDebugMessage(null, 'Does not match schema'));
