import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

/**
 * A single `plugins[]` entry from `buf.gen.yaml`.
 *
 * v1: `plugin:` is either a bare local plugin name (e.g. `go`) or a full
 * remote reference (e.g. `buf.build/protocolbuffers/go:v1.28.0`).
 * v2: remote plugins use a dedicated `remote:` key instead; `local:`/
 * `protoc_builtin:` plugins are not BSR references and are ignored here.
 */
const BufGenYamlPlugin = z
  .object({
    remote: z.string().optional(),
    plugin: z.string().optional(),
    revision: z.number().optional(),
  })
  .loose();

export const BufGenYaml = z.object({
  plugins: LooseArray(BufGenYamlPlugin).optional(),
});
