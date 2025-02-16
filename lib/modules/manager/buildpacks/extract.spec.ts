import { codeBlock } from 'common-tags';

import { extractPackageFile } from '.';

describe('modules/manager/buildpacks/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid files', () => {
      expect(extractPackageFile('not a project toml', '', {})).toBeNull();
    });

    it('returns null for empty package.toml', () => {
      const res = extractPackageFile(
        '[_]\nschema-version = "0.2"',
        'project.toml',
        {},
      );
      expect(res).toBeNull();
    });

    it('extracts builder and buildpack images', () => {
      const res = extractPackageFile(
        codeBlock`
[_]
schema-version = "0.2"

# valid cases
[io.buildpacks]
builder = "registry.corp/builder/noble:1.1.1"

[[io.buildpacks.group]]
uri = "docker://buildpacks/java:2.2.2"

[[io.buildpacks.group]]
uri = "buildpacks/nodejs:3.3.3"

[[io.buildpacks.group]]
uri = "example/foo@1.0.0"

[[io.buildpacks.group]]
uri = "urn:cnb:registry:example/bar@1.2.3"

[[io.buildpacks.group]]
uri = "cnbs/some-bp@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

[[io.buildpacks.group]]
uri = "cnbs/some-bp:some-tag@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

[[io.buildpacks.group]]
id = "example/tee"
version = "2.3.4"

#invalid cases

[[io.buildpacks.group]]
uri = "example/registry-cnb"

[[io.buildpacks.group]]
uri = "from=builder:foobar"

[[io.buildpacks.group]]
uri = "file://local.oci"

[[io.buildpacks.group]]
uri = "foo://fake.oci"

[[io.buildpacks.group]]
id = "not/valid"`,
        'project.toml',
        {},
      );
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          commitMessageTopic: 'builder {{depName}}',
          currentValue: '1.1.1',
          datasource: 'docker',
          depName: 'registry.corp/builder/noble',
          packageName: 'registry.corp/builder/noble',
          replaceString: 'registry.corp/builder/noble:1.1.1',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '2.2.2',
          datasource: 'docker',
          depName: 'buildpacks/java',
          packageName: 'buildpacks/java',
          replaceString: 'buildpacks/java:2.2.2',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '3.3.3',
          datasource: 'docker',
          depName: 'buildpacks/nodejs',
          packageName: 'buildpacks/nodejs',
          replaceString: 'buildpacks/nodejs:3.3.3',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          datasource: 'buildpacks-registry',
          currentValue: '1.0.0',
          packageName: 'example/foo',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          datasource: 'buildpacks-registry',
          currentValue: '1.2.3',
          packageName: 'example/bar',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest:
            'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          datasource: 'docker',
          depName: 'cnbs/some-bp',
          packageName: 'cnbs/some-bp',
          replaceString:
            'cnbs/some-bp@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest:
            'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          currentValue: 'some-tag',
          datasource: 'docker',
          depName: 'cnbs/some-bp',
          packageName: 'cnbs/some-bp',
          replaceString:
            'cnbs/some-bp:some-tag@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        },
        {
          datasource: 'buildpacks-registry',
          currentValue: '2.3.4',
          packageName: 'example/tee',
        },
      ]);
    });
  });
});
