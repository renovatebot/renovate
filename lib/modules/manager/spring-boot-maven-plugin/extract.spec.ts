import { Fixtures } from '../../../../test/fixtures';

import { extractPackageFile } from './extract';

describe('modules/manager/spring-boot-maven-plugin/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid files', () => {
      expect(extractPackageFile('not a pom xml', '', {})).toBeNull();
    });

    it('returns null for empty pom.xml', () => {
      const res = extractPackageFile(
        '<?xml version="1.0" encoding="UTF-8"?>',
        'pom.xml',
        {},
      );
      expect(res).toBeNull();
    });

    it('extracts builder and buildpack images', () => {
      const res = extractPackageFile(Fixtures.get('pom.xml'), 'pom.xml', {});
      //expect(res?.deps).toHaveLength(4);
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '0.4.316',
          datasource: 'docker',
          depName: 'paketobuildpacks/builder-jammy-base',
          replaceString: 'paketobuildpacks/builder-jammy-base:0.4.316',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '0.0.28',
          datasource: 'docker',
          depName: 'paketobuildpacks/run-noble-full',
          replaceString: 'paketobuildpacks/run-noble-full:0.0.28',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '12.1.0',
          datasource: 'docker',
          depName: 'paketo-buildpacks/java',
          replaceString: 'paketo-buildpacks/java:12.1.0',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '1.8.0',
          datasource: 'docker',
          depName: 'paketo-buildpacks/nodejs',
          replaceString: 'paketo-buildpacks/nodejs:1.8.0',
        },
      ]);
    });
  });
});
