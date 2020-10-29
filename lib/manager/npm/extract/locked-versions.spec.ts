import { getLockedVersions } from './locked-versions';

/** @type any */
const npm = require('./npm');
/** @type any */
const yarn = require('./yarn');

jest.mock('./npm');
jest.mock('./yarn');

describe('manager/npm/extract/locked-versions', () => {
  describe('.getLockedVersions()', () => {
    it.each([['1.22.0'], ['2.1.0'], ['2.2.0']])(
      'uses yarn.lock with yarn v%s',
      async (yarnVersion) => {
        yarn.getYarnLock.mockReturnValue({
          isYarn1: yarnVersion === '1.22.0',
          cacheVersion: yarnVersion === '2.2.0' ? 6 : NaN,
          lockedVersions: {
            'a@1.0.0': '1.0.0',
            'b@2.0.0': '2.0.0',
            'c@2.0.0': '3.0.0',
          },
        });
        const packageFiles = [
          {
            npmLock: 'package-lock.json',
            yarnLock: 'yarn.lock',
            constraints: {},
            deps: [
              {
                depName: 'a',
                currentValue: '1.0.0',
              },
              {
                depName: 'b',
                currentValue: '2.0.0',
              },
            ],
          },
        ];
        await getLockedVersions(packageFiles);
        expect(packageFiles).toMatchSnapshot();
      }
    );

    it('uses package-lock.json', async () => {
      npm.getNpmLock.mockReturnValue({
        a: '1.0.0',
        b: '2.0.0',
        c: '3.0.0',
      });
      const packageFiles = [
        {
          npmLock: 'package-lock.json',
          deps: [
            {
              depName: 'a',
              currentValue: '1.0.0',
            },
            {
              depName: 'b',
              currentValue: '2.0.0',
            },
          ],
        },
      ];
      await getLockedVersions(packageFiles);
      expect(packageFiles).toMatchSnapshot();
    });
    it('ignores pnpm', async () => {
      const packageFiles = [
        {
          pnpmShrinkwrap: 'pnpm-lock.yaml',
          deps: [
            {
              depName: 'a',
              currentValue: '1.0.0',
            },
            {
              depName: 'b',
              currentValue: '2.0.0',
            },
          ],
        },
      ];
      await getLockedVersions(packageFiles);
      expect(packageFiles).toMatchSnapshot();
    });
  });
});
