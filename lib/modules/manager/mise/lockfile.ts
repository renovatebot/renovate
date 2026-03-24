import upath from 'upath';
import { regEx } from '../../../util/regex.ts';

/**
 * Derives the lock file path from a mise config file path.
 * Matches mise's lockfile_path_for_config() logic from src/lockfile.rs
 */
export function getLockFileName(configPath: string): string {
  const filename = upath.basename(configPath);
  const dirname = upath.dirname(configPath);
  const parentDirname = upath.basename(dirname);

  // For conf.d files, lock file goes in parent directory
  const lockDir = parentDirname === 'conf.d' ? upath.dirname(dirname) : dirname;

  // Check if this is a local config
  const isLocal = filename.includes('.local.');

  // Extract environment from filename
  // Patterns: mise.{env}.toml, mise.{env}.local.toml, .mise.{env}.toml, config.{env}.toml
  const envMatch = regEx(
    /^(?:\.?mise|config)\.([^.]+)(?:\.local)?\.toml$/,
  ).exec(filename);
  const env = envMatch?.[1] === 'local' ? undefined : envMatch?.[1];

  // Build lock file name
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
