import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const ServicesIndexRaw = z.object({
  resources: LooseArray(
    z.object({
      '@id': z.string(),
      '@type': z.string(),
    }),
  ).catch([]),
});

export type ServicesIndexRaw = z.infer<typeof ServicesIndexRaw>;

const DeprecationSchema = z.object({
  reasons: z.array(z.string()),
});

export const CatalogEntrySchema = z.object({
  version: z.string(),
  published: z.string().optional(),
  projectUrl: z.string().optional(),
  listed: z.boolean().optional(),
  packageContent: z.string().optional(),
  deprecation: DeprecationSchema.optional(),
});

export type CatalogEntrySchema = z.infer<typeof CatalogEntrySchema>;

const CatalogItemSchema = z.object({
  catalogEntry: CatalogEntrySchema,
});

export const CatalogPage = z.object({
  '@id': z.string().optional(),
  items: LooseArray(CatalogItemSchema).optional(),
});

export type CatalogPage = z.infer<typeof CatalogPage>;

export const PackageRegistration = z.object({
  items: LooseArray(CatalogPage).optional(),
});

export type PackageRegistration = z.infer<typeof PackageRegistration>;
