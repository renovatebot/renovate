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

/**
 * `buf.yaml` module manifest. `deps[]` entries are BSR module references,
 * e.g. `buf.build/googleapis/googleapis` — optionally with a trailing
 * `:<reference>` label. The list is identical in shape for `v1` and `v2`.
 */
export const BufYaml = z
  .object({
    deps: LooseArray(z.string()).optional(),
  })
  .loose();

/**
 * A single `deps[]` entry from `buf.lock`, covering both config versions.
 *
 * v1: the module is spelled out as `remote` / `owner` / `repository`.
 * v2: it is a single `name` (e.g. `buf.build/googleapis/googleapis`).
 * Both pin a resolved `commit` (32-char hex) and content `digest`.
 */
const BufLockDep = z
  .object({
    name: z.string().optional(),
    remote: z.string().optional(),
    owner: z.string().optional(),
    repository: z.string().optional(),
    commit: z.string().optional(),
    digest: z.string().optional(),
  })
  .loose();

export const BufLock = z
  .object({
    deps: LooseArray(BufLockDep).optional(),
  })
  .loose();
