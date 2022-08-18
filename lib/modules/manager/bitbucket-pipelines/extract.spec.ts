import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

describe('modules/manager/bitbucket-pipelines/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts dependencies', () => {
      const res = extractPackageFile(Fixtures.get('bitbucket-pipelines.yaml'));
      expect(res?.deps).toMatchInlineSnapshot(`
        [
          {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "10.15.1",
            "datasource": "docker",
            "depName": "node",
            "depType": "docker",
            "replaceString": "node:10.15.1",
          },
          {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "10.15.2",
            "datasource": "docker",
            "depName": "node",
            "depType": "docker",
            "replaceString": "node:10.15.2",
          },
          {
            "currentValue": "0.2.1",
            "datasource": "bitbucket-tags",
            "depName": "atlassian/aws-s3-deploy",
            "depType": "bitbucket-tags",
          },
        ]
      `);
      expect(res?.deps).toHaveLength(3);
    });
  });
});
