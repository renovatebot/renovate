import { z } from 'zod';
import { LooseRecord, Yaml } from '../../../util/schema-utils';

export const WorkflowJobsSchema = Yaml.pipe(
  z.object({
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
      }),
    ).catch({}),
  }),
)
  .transform((v) => Object.values(v.jobs))
  .catch([]);
