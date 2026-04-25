import upath from 'upath';
import { regEx } from '../../../util/regex.ts';
import type { MiseLockFile } from './schema.ts';

export interface MiseConfigType {
  /** True when config filename contains `.local.` (e.g. mise.local.toml) */
  isLocal: boolean;
  /** Environment name extracted from filename, e.g. 'test' for mise.test.toml */
  env?: string;
}

/**
 * Parses the config file name to determine its type (local, env-specific, or default).
 * Used to derive the correct lock file name and `mise lock` flags.
 */
export function getConfigType(configPath: string): MiseConfigType {
  const filename = upath.basename(configPath);
  const isLocal = filename.includes('.local.');
  // Patterns: mise.{env}.toml, mise.{env}.local.toml, .mise.{env}.toml, config.{env}.toml
  const envMatch = regEx(
    /^(?:\.?mise|config)\.([^.]+)(?:\.local)?\.toml$/,
  ).exec(filename);
  const env = envMatch?.[1] === 'local' ? undefined : envMatch?.[1];
  return { isLocal, env };
}

/**
 * Derives the lock file path from a mise config file path.
 * Matches mise's lockfile_path_for_config() logic from src/lockfile.rs
 */
export function getLockFileName(configPath: string): string {
  const dirname = upath.dirname(configPath);
  const parentDirname = upath.basename(dirname);

  // For conf.d files, lock file goes in parent directory
  const lockDir = parentDirname === 'conf.d' ? upath.dirname(dirname) : dirname;

  const { isLocal, env } = getConfigType(configPath);

  let lockFileName: string;
  if (env && isLocal) {
    lockFileName = `mise.${env}.local.lock`;
  } else if (env) {
    lockFileName = `mise.${env}.lock`;
  } else if (isLocal) {
    lockFileName = 'mise.local.lock';
  } else {
    lockFileName = 'mise.lock';
  }

  return upath.join(lockDir, lockFileName);
}

/**
 * Get the locked version for a dependency from the parsed lock file.
 *
 * Mise lock files use different key formats depending on whether a tool is in
 * the mise registry:
 * - Registry tools (e.g., node, python): key is the short name ("node")
 * - Non-registry tools (e.g., ubi:owner/repo): key is the full name ("ubi:owner/repo")
 *
 * When a user specifies "core:node" in their config, mise resolves it to the
 * registry short name "node" in the lock file. But "aqua:cli/cli" (not in
 * registry) stays as "aqua:cli/cli" in the lock file.
 *
 * We use a fallback approach (Option A) rather than checking the registry (Option B):
 *
 * Option A (implemented): Try full depName first, then try stripped short name.
 *   Pros: Simple, no registry dependency, works even if Renovate's registry
 *         is out of sync with mise's registry.
 *   Cons: Theoretical collision risk if both "foo" and "backend:foo" exist
 *         in the same lock file (practically impossible - mise wouldn't generate this).
 *
 * Option B (not implemented): Check miseTooling/asdfTooling to determine if
 *   the tool is in the registry, then use short name or full name accordingly.
 *   Pros: Matches mise's exact logic.
 *   Cons: More complex, requires passing registry data, fails if Renovate's
 *         registry doesn't include a tool that mise's registry does.
 *
 * Option A is preferred because it's simpler, has no practical downsides, and
 * doesn't couple lock file parsing to Renovate's registry coverage.
 */
export function getLockedVersion(
  lockFileData: MiseLockFile,
  depName: string,
): string | undefined {
  // Try full name first (for non-registry tools like ubi:, aqua:)
  let lockedTools = lockFileData.tools[depName];

  // If not found and has backend prefix, try stripped name (for registry tools)
  if (!lockedTools) {
    const delimiterIndex = depName.indexOf(':');
    if (delimiterIndex !== -1) {
      const shortName = depName.substring(delimiterIndex + 1);
      lockedTools = lockFileData.tools[shortName];
    }
  }

  return lockedTools?.[0]?.version;
}
