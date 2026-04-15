import { z } from 'zod/v3';
import { LooseArray } from '../../../util/schema-utils/index.ts';
import { MaybeTimestamp } from '../../../util/timestamp.ts';

export const BazelModuleMetadata = z.object({
  homepage: z.string().optional().nullable(),
  versions: z.array(z.string()),
  yanked_versions: z.record(z.string(), z.string()).optional(),
});

export type BazelModuleMetadata = z.infer<typeof BazelModuleMetadata>;

const BcrVersionInfo = z.object({
  version: z.string(),
  submission: z.object({
    authorDateIso: MaybeTimestamp,
  }),
});

export const BcrPageData = z.object({
  props: z.object({
    pageProps: z.object({
      versionInfos: LooseArray(BcrVersionInfo),
    }),
  }),
});

export type BcrPageData = z.infer<typeof BcrPageData>;
