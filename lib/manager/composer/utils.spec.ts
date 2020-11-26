import { getName, partial } from '../../../test/util';
import { UpdateArtifact } from '../common';
import { extractContraints, getConstraint } from './utils';

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

    it('returns from null', () => {
      expect(
        getConstraint({
          ...config,
          newPackageFileContent: JSON.stringify({}),
        })
      ).toBeNull();
    });
  });
  describe('extractContraints', () => {
    it('returns from require', () => {
      expect(
        extractContraints(
          { require: { php: '>=5.3.2', 'composer/composer': '1.1.0' } },
          {}
        )
      ).toEqual({ php: '>=5.3.2', composer: '1.1.0' });
    });

    it('returns from require-dev', () => {
      expect(
        extractContraints(
          { 'require-dev': { 'composer/composer': '1.1.0' } },
          {}
        )
      ).toEqual({ composer: '1.1.0' });
    });

    it('returns from composer-runtime-api', () => {
      expect(
        extractContraints({ require: { 'composer-runtime-api': '^1.1.0' } }, {})
      ).toEqual({ composer: '1.*' });
    });

    it('returns from plugin-api-version', () => {
      expect(extractContraints({}, { 'plugin-api-version': '1.1.0' })).toEqual({
        composer: '1.*',
      });
    });

    it('fallback to 1.*', () => {
      expect(extractContraints({}, {})).toEqual({ composer: '1.*' });
    });
  });
});
