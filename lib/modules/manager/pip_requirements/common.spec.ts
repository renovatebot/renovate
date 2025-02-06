import { extractPackageFileFlags } from './common';

describe('modules/manager/pip_requirements/common', () => {
  describe('extractPackageFileFlags()', () => {
    it('extracts --index-url flag', () => {
      const res = extractPackageFileFlags(
        '--index-url https://example.com/pypi',
      );
      expect(res).toMatchObject({
        deps: [],
        registryUrls: ['https://example.com/pypi'],
      });
    });

    it('extracts --index-url short code', () => {
      const requirements = `-i http://example.com/private-pypi/
some-package==0.3.1`;

      const res = extractPackageFileFlags(requirements);

      expect(res).toMatchObject({
        deps: [],
        registryUrls: ['http://example.com/private-pypi/'],
      });
    });

    it('extracts --extra-index-url flag', () => {
      const res = extractPackageFileFlags(
        '--extra-index-url https://example.com/pypi',
      );
      expect(res).toMatchObject({
        deps: [],
        additionalRegistryUrls: ['https://example.com/pypi'],
      });
    });

    it('extracts --requirement short code option', () => {
      const requirements = `-r base.txt
some-package==0.3.1`;

      const res = extractPackageFileFlags(requirements);

      expect(res).toHaveProperty('managerData', {
        requirementsFiles: ['base.txt'],
      });
    });

    it('extracts --constraints short code option', () => {
      const requirements = `-c constrain.txt
some-package==0.3.1`;

      const res = extractPackageFileFlags(requirements);

      expect(res).toHaveProperty('managerData', {
        constraintsFiles: ['constrain.txt'],
      });
    });
  });
});
