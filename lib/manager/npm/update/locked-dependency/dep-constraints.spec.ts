import { loadJsonFixture } from '../../../../../test/util';
import { findDepConstraints } from './dep-constraints';

jest.mock('../../../../util/fs');

const packageJson = loadJsonFixture('package.json');
const packageLockJson = loadJsonFixture('package-lock.json');

describe('manager/npm/update/locked-dependency/dep-constraints', () => {
  describe('findDepConstraints()', () => {
    it('finds indirect dependency', () => {
      // FIXME: explicit assert condition
      expect(
        findDepConstraints(
          packageJson,
          packageLockJson,
          'send',
          '0.2.0',
          '0.2.1'
        )
      ).toMatchSnapshot();
    });
    it('finds direct dependency', () => {
      // FIXME: explicit assert condition
      expect(
        findDepConstraints(
          packageJson,
          packageLockJson,
          'express',
          '4.0.0',
          '4.5.0'
        )
      ).toMatchSnapshot();
    });
    it('finds direct devDependency', () => {
      const packageJsonDev = { ...packageJson };
      packageJsonDev.devDependencies = packageJsonDev.dependencies;
      delete packageJsonDev.dependencies;
      // FIXME: explicit assert condition
      expect(
        findDepConstraints(
          packageJsonDev,
          packageLockJson,
          'express',
          '4.0.0',
          '4.5.0'
        )
      ).toMatchSnapshot();
    });
  });
});
