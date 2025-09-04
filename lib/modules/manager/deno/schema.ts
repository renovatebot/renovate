import { z } from 'zod';
import { regEx } from '../../../util/regex';
import { Json, Jsonc } from '../../../util/schema-utils';

const imports = z.record(z.string()).optional();
const scopes = z.record(z.record(z.string())).optional();

// https://github.com/denoland/deno/blob/410c66ad0d1ce8a5a3b1a2f06c932fb66f25a3c6/cli/schemas/config-file.v1.json
export const DenoJsonFile = Jsonc.pipe(
  z.object({
    name: z.string().optional(),
    version: z.string().optional(),
    lock: z
      .union([
        z.string(),
        z.boolean(),
        z.object({
          path: z.string().optional(),
        }),
      ])
      .optional(),
    imports,
    scopes,
    importMap: z.string().optional(),
    /**
     * dependency in `tasks` can't sync lock file updating due to `deno install` is not supported
     */
    tasks: z
      .record(
        z.union([
          z.string(),
          z.object({
            command: z.string().optional(),
          }),
        ]),
      )
      .optional(),
    compilerOptions: z
      .object({
        types: z.array(z.string()).optional(),
        jsxImportSource: z.string().optional(),
        jsxImportSourceTypes: z.string().optional(),
      })
      .optional(),
    lint: z
      .object({
        plugins: z.array(z.string()).optional(),
      })
      .optional(),
    workspace: z
      .union([
        z.array(z.string()),
        z.object({
          members: z.array(z.string()),
        }),
      ])
      .optional(),
  }),
);

export type DenoJsonFile = z.infer<typeof DenoJsonFile>;

export const ImportMapJsonFile = Jsonc.pipe(
  z.object({
    imports,
    scopes,
  }),
);

export type ImportMapJsonFile = z.infer<typeof ImportMapJsonFile>;

// https://github.com/denoland/vscode_deno/blob/7e125c6ffcdcdebd587f97be5341d404f5335b87/schemas/lockfile.schema.json
const DenoLockV5 = z.object({
  version: z.string(),
  specifiers: z.record(z.string(), z.string()).optional(),
  redirects: z.record(z.string(), z.string()).optional(),
  remote: z.record(z.string(), z.string()).optional(),
});

export const DenoLock = Json.pipe(DenoLockV5).transform(
  ({ version, specifiers, redirects, remote }) => {
    const lockedVersions: Record<string, string> = {};
    if (specifiers) {
      for (const [key, val] of Object.entries(specifiers)) {
        // pick "7.1.3" from "7.1.3_pkgname@4.0.3_@types+pkgname@1.0.1"
        const match = regEx(/^(?<lockedVersion>[^_\s]+)/).exec(val);
        if (match?.groups?.lockedVersion) {
          lockedVersions[key] = match?.groups?.lockedVersion;
        }
      }
    }

    const redirectVersions = new Map<string, string>();
    if (redirects) {
      for (const [key, val] of Object.entries(redirects)) {
        redirectVersions.set(key, val);
      }
    }

    const remoteVersions = new Set<string>();
    if (remote) {
      for (const key of Object.keys(remote)) {
        remoteVersions.add(key);
      }
    }
    return {
      lockedVersions,
      redirectVersions,
      remoteVersions,
      lockfileVersion: Number(version),
    };
  },
);
