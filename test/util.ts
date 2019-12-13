import { platform as _platform } from '../lib/platform';
import { getConfig } from '../lib/config/defaults';

/**
 * Simple wrapper for getting mocked version of a module
 * @param module module which is mocked by `jest.mock`
 */
export function mocked<T>(module: T): jest.Mocked<T> {
  return module as never;
}

export const platform = mocked(_platform);

export const defaultConfig = getConfig();
