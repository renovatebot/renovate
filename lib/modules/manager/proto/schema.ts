import { z } from 'zod/v3';
import { Toml } from '../../../util/schema-utils/index.ts';

/**
 * Known non-version sections in .prototools files.
 * These are structured TOML tables, not version pins.
 * @see https://moonrepo.dev/docs/proto/config
 */
export const nonVersionKeys = new Set([
  'settings',
  'plugins',
  'tools',
  'env',
  'shell',
  'backends',
]);

export const ProtoToolsFile = Toml.pipe(
  z.record(z.unknown()).transform((data) => {
    const versions: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && !nonVersionKeys.has(key)) {
        versions[key] = value;
      }
    }
    return { versions };
  }),
);
export type ProtoToolsFile = z.infer<typeof ProtoToolsFile>;
