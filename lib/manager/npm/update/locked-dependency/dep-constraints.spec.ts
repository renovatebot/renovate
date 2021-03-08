import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { getName } from '../../../../../test/util';
import { findDepConstraints } from './dep-constraints';

jest.mock('../../../../util/fs');

const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, './__fixtures__/package.json'), 'utf8')
);
const packageLockJson = JSON.parse(
  readFileSync(resolve(__dirname, './__fixtures__/package-lock.json'), 'utf8')
);

describe(getName(__filename), () => {
  describe('findDepConstraints()', () => {
    it('finds indirect dependency', () => {
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
