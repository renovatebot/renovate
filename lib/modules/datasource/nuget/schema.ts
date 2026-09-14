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

const Deprecation = z.object({
  reasons: z.array(z.string()),
});

// See https://learn.microsoft.com/en-us/nuget/api/registration-base-url-resource#catalog-entry
export const CatalogEntry = z.object({
  version: z.string(),
  published: z.string().optional(),
  projectUrl: z.string().optional(),
  listed: z.boolean().optional(),
  packageContent: z.string().optional(),
  deprecation: Deprecation.optional(),
});

export type CatalogEntry = z.infer<typeof CatalogEntry>;

const CatalogItem = z.object({
  catalogEntry: CatalogEntry,
});

export const CatalogPage = z.object({
  '@id': z.string().optional(),
  items: LooseArray(CatalogItem).optional(),
});

export type CatalogPage = z.infer<typeof CatalogPage>;

export const PackageRegistration = z.object({
  items: LooseArray(CatalogPage).default([]),
});

export type PackageRegistration = z.infer<typeof PackageRegistration>;
