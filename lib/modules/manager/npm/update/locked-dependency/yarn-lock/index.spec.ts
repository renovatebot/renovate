import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { partial } from '~test/util.ts';
import type { UpdateLockedConfig } from '../../../../types.ts';
import { updateLockedDependency } from './index.ts';

const yarnLock1 = Fixtures.get('express.yarn.lock');
const yarn2Lock = Fixtures.get('yarn2.lock');

describe('modules/manager/npm/update/locked-dependency/yarn-lock/index', () => {
  describe('updateLockedDependency()', () => {
    let config: UpdateLockedConfig;

    beforeEach(() => {
      config = partial<UpdateLockedConfig>({ packageFile: 'package.json' });
    });

    it('returns if cannot parse lock file', () => {
      config.lockFileContent = 'abc123';
      expect(updateLockedDependency(config).status).toBe('update-failed');
    });

    it('returns if yarn lock 2', () => {
      config.lockFileContent = yarn2Lock;
      config.depName = 'chalk';
      config.currentVersion = '2.4.2';
      config.newVersion = '2.4.3';
      expect(updateLockedDependency(config).status).toBe('unsupported');
    });

    it('fails if cannot find dep', () => {
      config.lockFileContent = yarnLock1;
      config.depName = 'not-found';
      config.currentVersion = '1.0.0';
      config.newVersion = '1.0.1';
      expect(updateLockedDependency(config).status).toBe('update-failed');
    });

    it('returns already-updated', () => {
      config.lockFileContent = yarnLock1;
      config.depName = 'range-parser';
      config.currentVersion = '1.0.1';
      config.newVersion = '1.0.3';
      expect(updateLockedDependency(config).status).toBe('already-updated');
    });

    it('fails if cannot update dep in-range', () => {
      config.lockFileContent = yarnLock1;
      config.depName = 'send';
      config.currentVersion = '0.1.4';
      config.newVersion = '0.2.0';
      expect(updateLockedDependency(config).status).toBe('update-failed');
    });

    it('succeeds if can update within range', () => {
      config.lockFileContent = yarnLock1;
      config.depName = 'negotiator';
      config.currentVersion = '0.3.0';
      config.newVersion = '0.3.1';
      expect(updateLockedDependency(config).status).toBe('updated');
    });

    it.each`
      otherSelector            | targetSelector
      ${'other-foo@^1.0.0'}    | ${'foo@^1.0.0'}
      ${'"@scope/foo@^1.0.0"'} | ${'"foo@^1.0.0"'}
      ${'other-foo@^1.0.0'}    | ${'foo@~1.0.0, foo@^1.0.0'}
    `(
      'updates $targetSelector without changing $otherSelector',
      ({ otherSelector, targetSelector }) => {
        const lockFileContent = codeBlock`
          # yarn lockfile v1

          ${otherSelector}:
            version "1.0.0"
            resolved "https://registry.yarnpkg.com/other/-/other-1.0.0.tgz"

          ${targetSelector}:
            version "1.0.0"
            resolved "https://registry.yarnpkg.com/foo/-/foo-1.0.0.tgz"

          zzz@^1.0.0:
            version "1.0.0"
        `;

        const result = updateLockedDependency({
          ...config,
          lockFile: 'yarn.lock',
          lockFileContent,
          depName: 'foo',
          currentVersion: '1.0.0',
          newVersion: '1.0.1',
        });

        expect(result).toEqual({
          status: 'updated',
          files: {
            'yarn.lock': codeBlock`
              # yarn lockfile v1

              ${otherSelector}:
                version "1.0.0"
                resolved "https://registry.yarnpkg.com/other/-/other-1.0.0.tgz"

              ${targetSelector}:
                version "1.0.1"

              zzz@^1.0.0:
                version "1.0.0"
            `,
          },
        });
      },
    );
  });
});
