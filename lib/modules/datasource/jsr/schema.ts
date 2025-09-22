import { z } from 'zod';
import type { Release } from '../types';

// https://github.com/jsr-io/jsr/blob/b8d753f4ed96f032bc494e8809065cfe8df5c641/api/src/metadata.rs#L30-L35
export const JsrPackageMetadata = z
  .object({
    latest: z.string().optional(),
    versions: z.record(
      z.string(),
      z.object({
        yanked: z.boolean().optional(),
      }),
    ),
  })
  .transform(({ versions, latest }): Release[] => {
    return Object.entries(versions).map(([version, val]) => ({
      version,
      ...(val.yanked && { isDeprecated: true }),
      ...(latest === version && { isLatest: true }),
    }));
  });
