import { Fixtures } from '../../../../../../../test/fixtures';
import { findDepConstraints } from './dep-constraints';

jest.mock('../../../../../../util/fs');

const packageJson = Fixtures.getJson('package.json');
const packageLockJson = Fixtures.getJson('package-lock-v1.json');

describe('modules/manager/npm/update/locked-dependency/package-lock/dep-constraints', () => {
  describe('findDepConstraints()', () => {
    it('finds indirect dependency', () => {
      expect(
        findDepConstraints(
          packageJson,
          packageLockJson,
          'send',
          '0.2.0',
          '0.2.1',
        ),
      ).toEqual([
        {
          constraint: '0.2.0',
          parentDepName: 'express',
          parentVersion: '4.0.0',
        },
      ]);
    });

    it('finds direct dependency', () => {
      expect(
        findDepConstraints(
          packageJson,
          packageLockJson,
          'express',
          '4.0.0',
          '4.5.0',
        ),
      ).toEqual([{ constraint: '4.0.0', depType: 'dependencies' }]);
    });

    it('skips non-matching direct dependency', () => {
      expect(
        findDepConstraints(
          packageJson,
          packageLockJson,
          'express',
          '4.4.0',
          '4.5.0',
        ),
      ).toHaveLength(0);
    });

    it('finds direct devDependency', () => {
      const packageJsonDev = { ...packageJson };
      packageJsonDev.devDependencies = packageJsonDev.dependencies;
      delete packageJsonDev.dependencies;
      expect(
        findDepConstraints(
          packageJsonDev,
          packageLockJson,
          'express',
          '4.0.0',
          '4.5.0',
        ),
      ).toEqual([{ constraint: '4.0.0', depType: 'devDependencies' }]);
    });
  });
});
