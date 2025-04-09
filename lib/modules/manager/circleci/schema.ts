import { z } from 'zod';
import {
  LooseArray,
  LooseRecord,
  NotCircular,
} from '../../../util/schema-utils';

export const CircleCiDocker = z
  .object({ image: z.string() })
  .transform(({ image }) => image);

export const CircleCiJob = z
  .object({
    docker: LooseArray(CircleCiDocker).catch([]),
  })
  .transform(({ docker }) => docker);
export type CircleCiJob = z.infer<typeof CircleCiJob>;

const CircleCiJobList = LooseRecord(CircleCiJob)
  .transform((x) => Object.values(x).flat())
  .catch([]);

const BaseOrb = z.object({
  executors: CircleCiJobList,
  jobs: CircleCiJobList,
});

type Orb = z.infer<typeof BaseOrb> & {
  orbs: Record<string, string | Orb>;
};

export const CircleCiOrb: z.ZodType<Orb> = BaseOrb.extend({
  orbs: LooseRecord(z.union([z.string(), z.lazy(() => CircleCiOrb)])).catch({}),
}) as never;
export type CircleCiOrb = z.infer<typeof CircleCiOrb>;

export const CircleCiFile = NotCircular.pipe(
  BaseOrb.extend({
    aliases: LooseArray(CircleCiDocker).catch([]),
    orbs: LooseRecord(z.union([z.string(), CircleCiOrb])).catch({}),
  }),
);
export type CircleCiFile = z.infer<typeof CircleCiFile>;
