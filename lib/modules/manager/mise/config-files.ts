/**
 * Location of the config file fragments, which mise loads whatever their names are.
 */
export const confDLocation = '.config/mise/conf.d/*.toml';

/**
 * Locations of mise config files relative to the directory they apply to, highest precedence first.
 *
 * @see https://mise.jdx.dev/configuration.html
 * @see https://github.com/jdx/mise/blob/02d59ef93faf219319cccac23249501e8763e2da/src/config/mod.rs#L2530-L2608
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
