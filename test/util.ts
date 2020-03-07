import { platform as _platform } from '../lib/platform';
import { getConfig } from '../lib/config/defaults';
import { RenovateConfig as _RenovateConfig } from '../lib/config';

/**
 * Simple wrapper for getting mocked version of a module
 * @param module module which is mocked by `jest.mock`
 */
export function mocked<T>(module: T): jest.Mocked<T> {
  return module as never;
}

/**
 * Simply wrapper to create partial mocks.
 * @param obj Object to cast to final type
 */
export function partial<T>(obj: Partial<T>): T {
  return obj as T;
}

export const platform = mocked(_platform);

// Required because of isolatedModules
export type RenovateConfig = _RenovateConfig;

export const defaultConfig = getConfig();

export { getConfig };

export function getName(file: string): string {
  const [, name] = /lib\/(.*?)\.spec\.ts$/.exec(file.replace(/\\/g, '/'));
  return name;
}
