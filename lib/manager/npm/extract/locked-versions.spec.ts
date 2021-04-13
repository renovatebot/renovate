import { getName } from '../../../../test/util';
import { getLockedVersions } from './locked-versions';

/** @type any */
const npm = require('./npm');
/** @type any */
const yarn = require('./yarn');

jest.mock('./npm');
jest.mock('./yarn');

describe(getName(__filename), () => {
  describe('.getLockedVersions()', () => {
    it.each([['1.22.0'], ['2.1.0'], ['2.2.0']])(
      'uses yarn.lock with yarn v%s',
      async (yarnVersion) => {
        yarn.getYarnLock.mockReturnValue({
          isYarn1: yarnVersion === '1.22.0',
          lockfileVersion: yarnVersion === '2.2.0' ? 6 : undefined,
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
              {
                depType: 'engines',
                depName: 'yarn',
                currentValue: `^${yarnVersion}`,
              },
            ],
          },
        ];
        await getLockedVersions(packageFiles);
        expect(packageFiles).toMatchSnapshot();
      }
    );

    it.each([['6.0.0'], ['7.0.0']])(
      'uses package-lock.json with npm v%s',
      async (npmVersion) => {
        npm.getNpmLock.mockReturnValue({
          lockedVersions: {
            a: '1.0.0',
            b: '2.0.0',
            c: '3.0.0',
          },
          lockfileVersion: npmVersion === '7.0.0' ? 2 : 1,
        });
        const packageFiles = [
          {
            npmLock: 'package-lock.json',
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
    it('appends <7 to npm constraints', async () => {
      npm.getNpmLock.mockReturnValue({
        lockedVersions: {
          a: '1.0.0',
          b: '2.0.0',
          c: '3.0.0',
        },
        lockfileVersion: 1,
      });
      const packageFiles = [
        {
          npmLock: 'package-lock.json',
          constraints: {
            npm: '>=6.0.0',
          },
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
