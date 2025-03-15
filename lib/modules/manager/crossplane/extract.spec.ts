import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';
import { Fixtures } from '~test/fixtures';

const validPackages = Fixtures.get('validPackages.yml');
const malformedPackages = Fixtures.get('malformedPackages.yml');
const randomManifest = Fixtures.get('randomManifest.yml');
const mixedManifest = Fixtures.get('mixedManifest.yml');

describe('modules/manager/crossplane/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', 'packages.yml')).toBeNull();
    });

    it('strips invalid templates', () => {
      expect(extractPackageFile(`test: test: 123`, 'packages.yml')).toBeNull();
    });

    it('return null for kubernetes manifest', () => {
      const result = extractPackageFile(randomManifest, 'packages.yml');
      expect(result).toBeNull();
    });

    it('return invalid-value if deps are not valid images and ignore if missing', () => {
      const result = extractPackageFile(malformedPackages, 'packages.yml');
      expect(result).toMatchObject({
        deps: [
          {
            depType: 'function',
            skipReason: 'invalid-value',
          },
        ],
      });
    });

    it('return result for double quoted pkg.crossplane.io apiVersion reference', () => {
      const result = extractPackageFile(
        codeBlock`
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
        codeBlock`
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

    it('return no results for invalid resource', () => {
      const result = extractPackageFile(
        codeBlock`
        ---
        apiVersion: pkg.crossplane.io/v1
        kind: Configuration
        metadata:
          name: platform-ref-aws
        spec:
        `,
        'packages.yml',
      );
      expect(result).toBeNull();
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
            packageName: 'xpkg.upbound.io/crossplane-contrib/provider-nop',
            depType: 'provider',
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
            packageName: 'xpkg.upbound.io/crossplane-contrib/function-dummy',
            depType: 'function',
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
            packageName: 'xpkg.upbound.io/upbound/platform-ref-aws',
            depType: 'configuration',
            replaceString: 'xpkg.upbound.io/upbound/platform-ref-aws:v0.6.0',
          },
        ],
      });
    });

    it('should work even if there are other resources in the file', () => {
      const result = extractPackageFile(mixedManifest, 'packages.yml');
      expect(result).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: 'v0.2.0',
            datasource: 'docker',
            depName: 'xpkg.upbound.io/crossplane-contrib/provider-nop',
            packageName: 'xpkg.upbound.io/crossplane-contrib/provider-nop',
            depType: 'provider',
            replaceString:
              'xpkg.upbound.io/crossplane-contrib/provider-nop:v0.2.0',
          },
        ],
      });
    });
  });
});
