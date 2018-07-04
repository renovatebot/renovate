const {
  getLockedVersions,
} = require('../../../../lib/manager/npm/extract/locked-versions');

const npm = require('../../../../lib/manager/npm/extract/npm');
const yarn = require('../../../../lib/manager/npm/extract/yarn');

jest.mock('../../../../lib/manager/npm/extract/npm');
jest.mock('../../../../lib/manager/npm/extract/yarn');

describe('manager/npm/extract/locked-versions', () => {
  describe('.getLockedVersions()', () => {
    it('uses yarn.lock', async () => {
      yarn.getYarnLock.mockReturnValue({
        'a@1.0.0': '1.0.0',
        'b@2.0.0': '2.0.0',
        'c@2.0.0': '3.0.0',
      });
      const packageFiles = [
        {
          npmLock: 'package-lock.json',
          yarnLock: 'yarn.lock',
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
          pnpmShrinkwrap: 'shrinkwrap.yaml',
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
