import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

describe('modules/manager/cloudbuild/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts multiple image lines', () => {
      const res = extractPackageFile(Fixtures.get('cloudbuild.yml'));
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '19.03.8',
          datasource: 'docker',
          depName: 'gcr.io/cloud-builders/docker',
          packageName: 'gcr.io/cloud-builders/docker',
          replaceString: 'gcr.io/cloud-builders/docker:19.03.8',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '12',
          datasource: 'docker',
          depName: 'node',
          packageName: 'node',
          replaceString: 'node:12',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'gcr.io/cloud-builders/kubectl',
          packageName: 'gcr.io/cloud-builders/kubectl',
          replaceString: 'gcr.io/cloud-builders/kubectl',
        },
      ]);
      expect(res?.deps).toHaveLength(3);
    });
  });
});
