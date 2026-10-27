/**
 * Locations of mise config files relative to the directory they apply to, highest precedence first.
 *
 * @see https://mise.jdx.dev/configuration.html
 */
export const configFileLocations = [
  '.mise{,.*}.toml',
  'mise{,.*}.toml',
  'mise/config{,.*}.toml',
  '.mise/config{,.*}.toml',
  '.config/mise{,.*}.toml',
  '.config/mise/mise{,.*}.toml',
  '.config/mise/config{,.*}.toml',
  '.config/mise/conf.d/*.toml',
  '.rtx{,.*}.toml',
];

/**
 * Returns the `managerFilePatterns` entry of a config file location.
 */
export function getConfigFilePattern(location: string): string {
  return `**/${location}`;
}
