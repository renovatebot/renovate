import { getName, partial } from '../../../test/util';
import { UpdateArtifact } from '../common';
import { getConstraint } from './utils';

describe(getName(__filename), () => {
  describe('getConstraint', () => {
    const config = partial<UpdateArtifact>({
      packageFileName: 'composer.json',
      config: {},
    });
    it('returns from config', () => {
      expect(
        getConstraint({
          ...config,
          config: { constraints: { composer: '1.1.0' } },
        })
      ).toEqual('1.1.0');
    });

    it('returns from require', () => {
      expect(
        getConstraint({
          ...config,
          newPackageFileContent: JSON.stringify({
            require: { 'composer/composer': '1.1.0' },
          }),
        })
      ).toEqual('1.1.0');
    });

    it('returns from require-dev', () => {
      expect(
        getConstraint({
          ...config,
          newPackageFileContent: JSON.stringify({
            'require-dev': { 'composer/composer': '1.1.0' },
          }),
        })
      ).toEqual('1.1.0');
    });

    it('returns from null', () => {
      expect(
        getConstraint({
          ...config,
          newPackageFileContent: JSON.stringify({}),
        })
      ).toBeNull();
    });
  });
});
