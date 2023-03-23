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
            "currentValue": "14",
            "datasource": "docker",
            "depName": "node",
            "depType": "docker",
            "replaceString": "node:14",
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
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "2.0.2",
            "datasource": "docker",
            "depName": "jfrogecosystem/jfrog-setup-cli",
            "depType": "docker",
            "replaceString": "jfrogecosystem/jfrog-setup-cli:2.0.2",
          },
          {
            "currentValue": "0.2.1",
            "datasource": "bitbucket-tags",
            "depName": "atlassian/aws-s3-deploy",
            "depType": "bitbucket-tags",
          },
          {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "16",
            "datasource": "docker",
            "depName": "node",
            "depType": "docker",
            "replaceString": "node:16",
          },
        ]
      `);
      expect(res?.deps).toHaveLength(6);
    });
  });
});
