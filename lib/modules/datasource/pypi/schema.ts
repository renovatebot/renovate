import { z } from 'zod/v4';
import { DeepNullish, LooseArray } from '../../../util/schema-utils/index.ts';

export const PypiRelease = DeepNullish(
  z.object({
    requires_python: z.string().optional(),
    upload_time: z.string().optional(),
    yanked: z.boolean().optional().default(false),
  }),
);

export type PypiRelease = z.infer<typeof PypiRelease>;

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

// JSON-based Simple API (PEP 691) schemas
// https://peps.python.org/pep-0691/
export const PypiSimpleFile = DeepNullish(
  z.object({
    filename: z.string(),
    'requires-python': z.string().optional(),
    yanked: z.union([z.boolean(), z.string()]).optional().default(false),
    // `upload-time` is specified by PEP 700
    'upload-time': z.string().optional(),
  }),
);
export type PypiSimpleFile = z.infer<typeof PypiSimpleFile>;

export const PypiSimpleResponse = z.object({
  files: LooseArray(PypiSimpleFile),
});
export type PypiSimpleResponse = z.infer<typeof PypiSimpleResponse>;
