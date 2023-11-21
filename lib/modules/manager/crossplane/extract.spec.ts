import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const validPackages = Fixtures.get('validPackages.yml');
const malformedPackages = Fixtures.get('malformedPackages.yml');
const randomManifest = Fixtures.get('randomManifest.yml');

describe('modules/manager/crossplane/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', 'packages.yml')).toBeNull();
    });

    it('returns null for invalid', () => {
      expect(
        extractPackageFile(`${malformedPackages}\n123`, 'packages.yml'),
      ).toBeNull();
    });

    it('return null for kubernetes manifest', () => {
      const result = extractPackageFile(randomManifest, 'packages.yml');
      expect(result).toBeNull();
    });

    it('return invalid-value if deps are not valid images or missing', () => {
      const result = extractPackageFile(malformedPackages, 'packages.yml');
      expect(result).toBeNull();
    });

    it('return result for double quoted pkg.crossplane.io apiVersion reference', () => {
      const result = extractPackageFile(
        `
apiVersion: "pkg.crossplane.io/v1"
kind: Configuration
spec:
  package: "xpkg.upbound.io/upbound/platform-ref-aws:v0.6.0"
        `,
        'packages.yml',
      );
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: 'v0.6.0',
            datasource: 'docker',
            depName: 'xpkg.upbound.io/upbound/platform-ref-aws',
          },
        ],
      });
    });

    it('return result for single quoted pkg.crossplane.io apiVersion reference', () => {
      const result = extractPackageFile(
        `
apiVersion: 'pkg.crossplane.io/v1'
kind: Configuration
spec:
  package: 'xpkg.upbound.io/upbound/platform-ref-aws:v0.6.0'
        `,
        'packages.yml',
      );
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: 'v0.6.0',
            datasource: 'docker',
            depName: 'xpkg.upbound.io/upbound/platform-ref-aws',
          },
        ],
      });
    });

    it('full test', () => {
      const result = extractPackageFile(validPackages, 'packages.yml');
      expect(result).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: 'v0.2.0',
            datasource: 'docker',
            depName: 'xpkg.upbound.io/crossplane-contrib/provider-nop',
            depType: 'docker',
            replaceString:
              'xpkg.upbound.io/crossplane-contrib/provider-nop:v0.2.0',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: 'v0.2.1',
            datasource: 'docker',
            depName: 'xpkg.upbound.io/crossplane-contrib/function-dummy',
            depType: 'docker',
            replaceString:
              'xpkg.upbound.io/crossplane-contrib/function-dummy:v0.2.1',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: 'v0.6.0',
            datasource: 'docker',
            depName: 'xpkg.upbound.io/upbound/platform-ref-aws',
            depType: 'docker',
            replaceString: 'xpkg.upbound.io/upbound/platform-ref-aws:v0.6.0',
          },
        ],
      });
    });
  });
});
