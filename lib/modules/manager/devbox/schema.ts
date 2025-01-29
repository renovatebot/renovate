import { z } from 'zod';
import { Jsonc } from '../../../util/schema-utils';

type Packages = Record<string, string | undefined>;

export const DevboxSchema = z.object({
  packages: z
    .union([
      z.array(z.string()),
      z.record(z.union([z.string(), z.object({ version: z.string() })])),
    ])
    .transform((packages): Packages => {
      const result: Packages = {};
      if (Array.isArray(packages)) {
        for (const pkg of packages) {
          const [name, version] = pkg.split('@');
          result[name] = version;
        }
      } else {
        for (const [name, value] of Object.entries(packages)) {
          if (typeof value === 'string') {
            result[name] = value;
          } else {
            result[name] = value.version;
          }
        }
      }
      return result;
    }),
});

export const DevboxFileSchema = Jsonc.pipe(DevboxSchema);
