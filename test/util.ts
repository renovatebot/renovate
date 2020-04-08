import * as upath from 'upath';
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
 * Partially mock a module, providing an object with explicit mocks
 * @param moduleName The module to mock
 * @param overrides An object containing the mocks
 * @example
 * jest.mock('../../util/exec/docker/index', () =>
 *   require('../../../test/util').mockPartial('../../util/exec/docker/index', {
 *     removeDanglingContainers: jest.fn(),
 *   })
 * );
 */
export function mockPartial(moduleName: string, overrides?: object): unknown {
  const absolutePath = upath.join(module.parent.filename, '../', moduleName);
  const originalModule = jest.requireActual(absolutePath);
  return {
    __esModule: true,
    ...originalModule,
    ...overrides,
  };
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

/**
 * Can be used to search and replace strings in jest snapshots.
 * @example
 * expect.addSnapshotSerializer(
 *     replacingSerializer(upath.toUnix(gradleDir.path), 'localDir')
 * );
 */
export const replacingSerializer = (
  search: string,
  replacement: string
): jest.SnapshotSerializerPlugin => ({
  test: value => typeof value === 'string' && value.includes(search),
  serialize: (val, config, indent, depth, refs, printer) => {
    const replaced = (val as string).replace(search, replacement);
    return printer(replaced, config, indent, depth, refs);
  },
});
