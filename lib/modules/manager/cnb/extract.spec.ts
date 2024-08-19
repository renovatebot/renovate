import { Fixtures } from '../../../../test/fixtures';

import { extractPackageFile } from '.';

describe('modules/manager/cnb/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid files', () => {
      expect(extractPackageFile('not a project toml', '', {})).toBeNull();
    });

    it('returns null for empty package.toml', () => {
      const res = extractPackageFile(
        Fixtures.get('empty_project.toml'),
        'project.toml',
        {},
      );
      expect(res).toBeNull();
    });

    it('extracts builder and buildpack images', () => {
      const res = extractPackageFile(
        Fixtures.get('project.toml'),
        'project.toml',
        {},
      );
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '1.1.1',
          datasource: 'docker',
          depName: 'registry.corp/builder/noble',
          replaceString: 'registry.corp/builder/noble:1.1.1',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '2.2.2',
          datasource: 'docker',
          depName: 'buildpacks/java',
          replaceString: 'buildpacks/java:2.2.2',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '3.3.3',
          datasource: 'docker',
          depName: 'buildpacks/nodejs',
          replaceString: 'buildpacks/nodejs:3.3.3',
        },
      ]);
    });
  });
});
