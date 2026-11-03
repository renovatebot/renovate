/**
 * Location of the config file fragments, which mise loads whatever their names are.
 */
export const confDLocation = '.config/mise/conf.d/*.toml';

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
  confDLocation,
  '.rtx{,.*}.toml',
];

/**
 * Returns the `managerFilePatterns` entry of a config file location.
 */
export function getConfigFilePattern(location: string): string {
  return `**/${location}`;
}
