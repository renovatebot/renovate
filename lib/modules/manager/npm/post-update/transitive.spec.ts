import type { Upgrade } from '../../types.ts';
import { getTransitiveUpdateNotice, isTransitiveUpdate } from './transitive.ts';

function lockFile(packages: Record<string, unknown>): string {
  return JSON.stringify({ lockfileVersion: 3, packages });
}

function transitive(
  depName: string,
  currentVersion: string,
  newVersion: string,
): Upgrade {
  return {
    depName,
    packageName: depName,
    depType: 'package-lock.json',
    currentVersion,
    newVersion,
    isLockfileUpdate: true,
  };
}

describe('modules/manager/npm/post-update/transitive', () => {
  describe('isTransitiveUpdate()', () => {
    it('is true only for a dependency extracted from the lock file', () => {
      expect(isTransitiveUpdate(transitive('braces', '3.0.2', '3.0.3'))).toBe(
        true,
      );
      expect(isTransitiveUpdate({ depType: 'dependencies' })).toBe(false);
    });
  });

  describe('getTransitiveUpdateNotice()', () => {
    it('returns null when the lock file holds the planned versions', () => {
      expect(
        getTransitiveUpdateNotice(
          lockFile({ 'node_modules/braces': { version: '3.0.3' } }),
          [transitive('braces', '3.0.2', '3.0.3')],
        ),
      ).toBeNull();
    });

    it('says which versions the lock file holds, where they differ from the plan', () => {
      expect(
        getTransitiveUpdateNotice(
          lockFile({
            'node_modules/semver': { version: '6.3.2' },
            'node_modules/normalize-package-data/node_modules/semver': {
              version: '5.7.3',
            },
            'node_modules/node-abi/node_modules/semver': { version: '7.8.6' },
          }),
          [
            transitive('semver', '5.7.1', '5.7.2'),
            transitive('semver', '6.3.0', '6.3.1'),
            transitive('semver', '7.5.1', '7.5.2'),
          ],
        ),
      ).toBe(
        [
          'Transitive dependencies are updated with `npm update`, within the ranges the packages which depend on them allow:',
          '',
          '- `semver` is now locked at `5.7.3`, `6.3.2` and `7.8.6`, the newest versions the packages which depend on it allow.',
        ].join('\n'),
      );
    });

    it('says when a package is no longer in the lock file', () => {
      expect(
        getTransitiveUpdateNotice(lockFile({}), [
          transitive('braces', '3.0.2', '3.0.3'),
        ]),
      ).toBe(
        [
          'Transitive dependencies are updated with `npm update`, within the ranges the packages which depend on them allow:',
          '',
          '- `braces` is no longer in the lock file.',
        ].join('\n'),
      );
    });

    it('says which versions could not be updated', () => {
      expect(
        getTransitiveUpdateNotice(
          lockFile({
            'node_modules/cookie': { version: '0.5.0' },
            'node_modules/semver': { version: '6.3.0' },
            'node_modules/node-abi/node_modules/semver': { version: '7.5.2' },
          }),
          [
            transitive('cookie', '0.5.0', '0.7.0'),
            transitive('semver', '6.3.0', '6.3.1'),
            transitive('semver', '7.5.1', '7.5.2'),
          ],
        ),
      ).toBe(
        [
          'Transitive dependencies are updated with `npm update`, within the ranges the packages which depend on them allow:',
          '',
          '- `cookie@0.5.0` could not be updated, because the packages which depend on it do not allow a newer version.',
          '- `semver@6.3.0` could not be updated, because the packages which depend on it do not allow a newer version.',
        ].join('\n'),
      );
    });
  });
});
