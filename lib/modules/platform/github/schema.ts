import { z } from 'zod';

const PackageSchema = z.object({
  ecosystem: z.union([
    z.literal('maven'),
    z.literal('npm'),
    z.literal('nuget'),
    z.literal('pip'),
    z.literal('rubygems'),
    z.literal('rust'),
    z.literal('composer'),
    z.literal('go'),
  ]),
  name: z.string(),
});

const SecurityVulnerabilitySchema = z
  .object({
    first_patched_version: z.object({ identifier: z.string() }).optional(),
    package: PackageSchema,
    vulnerable_version_range: z.string(),
  })
  .nullable();

const SecurityAdvisorySchema = z.object({
  description: z.string(),
  identifiers: z.array(
    z.object({
      type: z.string(),
      value: z.string(),
    }),
  ),
  references: z.array(z.object({ url: z.string() })).optional(),
});

export const VulnerabilityAlertSchema = z.array(
  z.object({
    dismissed_reason: z.string().nullish(),
    security_advisory: SecurityAdvisorySchema,
    security_vulnerability: SecurityVulnerabilitySchema,
    dependency: z.object({
      manifest_path: z.string(),
    }),
  }),
);
