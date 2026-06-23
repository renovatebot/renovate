import { z } from 'zod/v4';
import {
  DeepNullish,
  Json,
  LooseArray,
} from '../../../util/schema-utils/index.ts';

export const PypiRelease = DeepNullish(
  z.object({
    requires_python: z.string().optional(),
    upload_time: z.string().optional(),
    yanked: z.boolean().optional().default(false),
  }),
);

export type PypiRelease = z.infer<typeof PypiRelease>;

// JSON serialization of the simple API (PEP 691)
export const PypiSimpleFile = z.object({
  filename: z.string(),
  'requires-python': z.string().nullish(),
  // `upload-time` is exposed by the simple API since PEP 700
  'upload-time': z.string().nullish(),
  // `yanked` may be a boolean or a non-empty string with the yank reason
  yanked: z.union([z.boolean(), z.string()]).nullish(),
});

export type PypiSimpleFile = z.infer<typeof PypiSimpleFile>;

export const PypiSimpleJson = Json.pipe(
  z.object({
    files: LooseArray(PypiSimpleFile),
  }),
);

export type PypiSimpleJson = z.infer<typeof PypiSimpleJson>;

export const PypiResponse = DeepNullish(
  z.object({
    info: z
      .object({
        name: z.string().optional(),
        home_page: z.string().optional(),
        project_urls: z.record(z.string(), z.string().optional()).optional(),
      })
      .optional(),
    releases: z.record(z.string(), z.array(PypiRelease)).optional(),
  }),
);

export type PypiResponse = z.infer<typeof PypiResponse>;
