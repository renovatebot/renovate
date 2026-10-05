import type { PackageJson } from '../schema.ts';
import { getPackageManagerVersion } from './utils.ts';

describe('modules/manager/npm/post-update/utils', () => {
  describe('getPackageManagerVersion', () => {
    it.each`
      name      | arrayForm
      ${'npm'}  | ${false}
      ${'npm'}  | ${true}
      ${'pnpm'} | ${false}
      ${'pnpm'} | ${true}
      ${'yarn'} | ${false}
      ${'yarn'} | ${true}
    `(
      'prefers devEngines for $name with array form: $arrayForm',
      ({ name, arrayForm }) => {
        const item = { name, version: '9.0.0' };
        const pkg: PackageJson = {
          devEngines: { packageManager: arrayForm ? [item] : item },
          volta: { [name]: '8.0.0' },
          packageManager: { name, version: '7.0.0' },
          engines: { [name]: '6.0.0' },
        };

        expect(getPackageManagerVersion(name, pkg)).toBe('9.0.0');
      },
    );

    it.each`
      packageManager
      ${{ name: 'yarn', version: '4.0.0' }}
      ${{ name: 'pnpm' }}
      ${[]}
      ${[{ name: 'yarn', version: '4.0.0' }]}
      ${[{ name: 'pnpm' }]}
    `(
      'uses volta when devEngines has no version for the requested tool: $packageManager',
      ({ packageManager }) => {
        const pkg: PackageJson = {
          devEngines: { packageManager },
          volta: { pnpm: '8.0.0' },
          packageManager: { name: 'pnpm', version: '7.0.0' },
          engines: { pnpm: '6.0.0' },
        };

        expect(getPackageManagerVersion('pnpm', pkg)).toBe('8.0.0');
      },
    );

    it('uses the top-level packageManager when devEngines has no matching tool and volta is absent', () => {
      const pkg: PackageJson = {
        devEngines: { packageManager: { name: 'yarn', version: '4.0.0' } },
        packageManager: { name: 'pnpm', version: '7.0.0' },
        engines: { pnpm: '6.0.0' },
      };

      expect(getPackageManagerVersion('pnpm', pkg)).toBe('7.0.0');
    });
  });
});
