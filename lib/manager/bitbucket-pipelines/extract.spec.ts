import { loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const bitbucketPipelinesYAML = loadFixture('bitbucket-pipelines.yaml');

describe('manager/bitbucket-pipelines/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts dependencies', () => {
      const res = extractPackageFile(bitbucketPipelinesYAML);
      expect(res.deps).toMatchInlineSnapshot(`
Array [
  Object {
    "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
    "currentDigest": undefined,
    "currentValue": "10.15.1",
    "datasource": "docker",
    "depName": "node",
    "depType": "docker",
    "replaceString": "node:10.15.1",
  },
  Object {
    "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
    "currentDigest": undefined,
    "currentValue": "10.15.2",
    "datasource": "docker",
    "depName": "node",
    "depType": "docker",
    "replaceString": "node:10.15.2",
  },
  Object {
    "currentValue": "0.2.1",
    "datasource": "bitbucket-tags",
    "depName": "atlassian/aws-s3-deploy",
    "depType": "bitbucket-tags",
  },
]
`);
      expect(res.deps).toHaveLength(3);
    });
  });
});
