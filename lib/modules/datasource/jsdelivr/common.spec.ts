import { parseJsDelivrPackageName } from './common.ts';

describe('modules/datasource/jsdelivr/common', () => {
  describe('parseJsDelivrPackageName', () => {
    it('splits gh package names', () => {
      expect(parseJsDelivrPackageName('gh/twbs/bootstrap')).toEqual({
        type: 'gh',
        package: 'twbs/bootstrap',
        asset: '',
      });
    });

    it('splits npm scoped package names', () => {
      expect(parseJsDelivrPackageName('npm/@popperjs/core')).toEqual({
        type: 'npm',
        package: '@popperjs/core',
        asset: '',
      });
    });

    it('splits npm package names', () => {
      expect(parseJsDelivrPackageName('npm/jquery')).toEqual({
        type: 'npm',
        package: 'jquery',
        asset: '',
      });
    });

    it('removes version tags from gh package names', () => {
      expect(parseJsDelivrPackageName('gh/twbs/bootstrap@5.3.8')).toEqual({
        type: 'gh',
        package: 'twbs/bootstrap',
        asset: '',
      });
    });

    it('removes version tags from scoped npm package names', () => {
      expect(parseJsDelivrPackageName('npm/@popperjs/core@2.11.8')).toEqual({
        type: 'npm',
        package: '@popperjs/core',
        asset: '',
      });
    });

    it('removes version tags from npm package names', () => {
      expect(parseJsDelivrPackageName('npm/jquery@4.0.0')).toEqual({
        type: 'npm',
        package: 'jquery',
        asset: '',
      });
    });

    it('preserves assets in gh packages', () => {
      expect(
        parseJsDelivrPackageName(
          'gh/twbs/bootstrap@5.3.8/dist/js/bootstrap.min.js',
        ),
      ).toEqual({
        type: 'gh',
        package: 'twbs/bootstrap',
        asset: 'dist/js/bootstrap.min.js',
      });
    });

    it('preserves assets in scoped npm packages', () => {
      expect(
        parseJsDelivrPackageName(
          'npm/@popperjs/core@2.11.8/dist/umd/popper.min.js',
        ),
      ).toEqual({
        type: 'npm',
        package: '@popperjs/core',
        asset: 'dist/umd/popper.min.js',
      });
    });

    it('preserves assets in unscoped npm packages', () => {
      expect(
        parseJsDelivrPackageName('npm/jquery@4.0.0/dist/jquery.min.js'),
      ).toEqual({
        type: 'npm',
        package: 'jquery',
        asset: 'dist/jquery.min.js',
      });
    });

    it('throws error for unkown package types', () => {
      expect(() => parseJsDelivrPackageName('packages/npm/jquery')).toThrow(
        "Unknown package type: packages (possible values: 'npm', 'gh')",
      );
    });
  });
});
