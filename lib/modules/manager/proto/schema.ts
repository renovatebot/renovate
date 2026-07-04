import { isPlainObject, isString } from '@sindresorhus/is';
import { z } from 'zod/v4';
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
  z.record(z.string(), z.unknown()).transform((data) => {
    const versions: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (isString(value) && !nonVersionKeys.has(key)) {
        versions[key] = value;
      }
    }

    const plugins: Record<string, string> = {};
    collectStringValues(data.plugins, plugins);
    if (isPlainObject(data.plugins)) {
      // `[plugins.tools]` (v0.52+) takes precedence over legacy `[plugins]`.
      collectStringValues(data.plugins.tools, plugins);
    }

    return { versions, plugins };
  }),
);
export type ProtoToolsFile = z.infer<typeof ProtoToolsFile>;

function collectStringValues(
  value: unknown,
  target: Record<string, string>,
): void {
  if (!isPlainObject(value)) {
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (isString(entry)) {
      target[key] = entry;
    }
  }
}
