import { z } from 'zod';

const DepObjectSchema = z.object({
  currentValue: z.string().optional(),
  datasource: z.string().optional(),
  depName: z.string().optional(),
  packageName: z.string().optional(),
  currentDigest: z.string().optional(),
  versioning: z.string().optional(),
  depType: z.string().optional(),
  registryUrl: z.string().optional(),
  extractVersion: z.string().optional(),
  indentation: z.string().optional(),
});

export const QueryResultZodSchema = z
  .union([z.array(DepObjectSchema), DepObjectSchema])
  .transform((input) => {
    return Array.isArray(input) ? input : [input];
  });
