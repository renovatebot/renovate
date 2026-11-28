import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { fakeSha } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { extractPackageFile } from './index.ts';

const yamlFileMultiConfig = Fixtures.get('gitlab-ci.1.yaml');
const yamlFileSingleConfig = Fixtures.get('gitlab-ci.2.yaml');
const yamlWithEmptyIncludeConfig = Fixtures.get('gitlab-ci.3.yaml');
const yamlWithTriggerRef = Fixtures.get('gitlab-ci.4.yaml');

const sha1 = fakeSha('gitlabci-include-1');
const sha256 = `${fakeSha('gitlabci-include-a')}${fakeSha('gitlabci-include-b').slice(0, 24)}`;

describe('modules/manager/gitlabci-include/extract', () => {
  beforeEach(() => {
    GlobalConfig.reset();
  });

  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('returns null for invalid YAML', () => {
      expect(
        extractPackageFile('include: [unclosed', '.gitlab-ci.yml'),
      ).toBeNull();
    });

    it('returns null for include block without any actual includes', () => {
      const res = extractPackageFile(yamlWithEmptyIncludeConfig);
      expect(res).toBeNull();
    });

    it('extracts single include block', () => {
      const res = extractPackageFile(yamlFileSingleConfig);
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            'ref: {{#if newDigest}}{{newDigest}}{{#if newValue}} # {{newValue}}{{/if}}{{else}}{{newValue}}{{/if}}',
          currentValue: '1.0.0',
          datasource: 'gitlab-tags',
          depName: 'mikebryant/include-source-example',
          depType: 'repository',
          replaceString: 'ref: 1.0.0',
        },
      ]);
    });

    it('extracts multiple include blocks', () => {
      const res = extractPackageFile(yamlFileMultiConfig);
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            'ref: {{#if newDigest}}{{newDigest}}{{#if newValue}} # {{newValue}}{{/if}}{{else}}{{newValue}}{{/if}}',
          currentValue: '1.0.0',
          datasource: 'gitlab-tags',
          depName: 'mikebryant/include-source-example',
          depType: 'repository',
          replaceString: 'ref: 1.0.0',
        },
        {
          autoReplaceStringTemplate:
            'ref: {{#if newDigest}}{{newDigest}}{{#if newValue}} # {{newValue}}{{/if}}{{else}}{{newValue}}{{/if}}',
          currentValue: 'master',
          datasource: 'gitlab-tags',
          depName: 'mikebryant/include-source-example2',
          depType: 'repository',
          replaceString: 'ref: master',
        },
        {
          datasource: 'gitlab-tags',
          depName: 'mikebryant/include-source-example3',
          depType: 'repository',
          skipReason: 'unspecified-version',
        },
      ]);
    });

    it('extracts multiple embedded include blocks', () => {
      const res = extractPackageFile(yamlWithTriggerRef);
      expect(res?.deps).toHaveLength(2);
      expect(res?.deps).toMatchObject([
        {
          currentValue: 'master',
          datasource: 'gitlab-tags',
          depName: 'mikebryant/include-source-example',
          replaceString: 'ref: master',
        },
        {
          currentValue: '1.0.0',
          datasource: 'gitlab-tags',
          depName: 'mikebryant/include-source-example',
          replaceString: 'ref: 1.0.0',
        },
      ]);
    });

    it('ignores includes without project and file keys', () => {
      const includeWithoutProjectRef = codeBlock`
        include:
              - 'https://gitlab.com/mikebryant/include-source-example.yml'
              - remote: 'https://gitlab.com/mikebryant/include-source-example.yml'
              - local: mikebryant/include-source-example
      `;
      const res = extractPackageFile(includeWithoutProjectRef);
      expect(res).toBeNull();
    });

    it('normalizes configured endpoints', () => {
      const endpoints = [
        'http://gitlab.test/api/v4',
        'http://gitlab.test/api/v4/',
      ];

      for (const endpoint of endpoints) {
        GlobalConfig.set({ platform: 'gitlab', endpoint });
        const res = extractPackageFile(yamlFileMultiConfig);
        expect(res?.deps[0].registryUrls).toEqual(['http://gitlab.test']);
      }
    });

    it('supports multi-document files', () => {
      const multiDocFile = codeBlock`
        other:
          content: to be ignored
        ---
        include:
          - project: mikebryant/include-source-example
            ref: 1.0.0
        ---
        include:
          - project: mikebryant/include-source-example2
            ref: 2.0.0
        ---
        more:
          content: to be ignored
      `;
      const res = extractPackageFile(multiDocFile);
      expect(res).toMatchObject({
        deps: [
          {
            currentValue: '1.0.0',
            datasource: 'gitlab-tags',
            depName: 'mikebryant/include-source-example',
            replaceString: 'ref: 1.0.0',
          },
          {
            currentValue: '2.0.0',
            datasource: 'gitlab-tags',
            depName: 'mikebryant/include-source-example2',
            replaceString: 'ref: 2.0.0',
          },
        ],
      });
    });

    it('preserves double and single quotes on unpinned refs', () => {
      const content = codeBlock`
        include:
          - project: "my-org/double-quoted"
            ref: "v2.0.0" # Unpinned tag
            file: "scan.yml"
          - project: 'my-org/single-quoted'
            ref: 'v3.0.0'
            file: 'build.yml'
      `;

      const res = extractPackageFile(content);

      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            'ref: "{{#if newDigest}}{{newDigest}}"{{#if newValue}} # {{newValue}}{{/if}}{{else}}{{newValue}}"{{/if}}',
          currentValue: 'v2.0.0',
          datasource: 'gitlab-tags',
          depName: 'my-org/double-quoted',
          depType: 'repository',
          replaceString: 'ref: "v2.0.0"',
        },
        {
          autoReplaceStringTemplate:
            "ref: '{{#if newDigest}}{{newDigest}}'{{#if newValue}} # {{newValue}}{{/if}}{{else}}{{newValue}}'{{/if}}",
          currentValue: 'v3.0.0',
          datasource: 'gitlab-tags',
          depName: 'my-org/single-quoted',
          depType: 'repository',
          replaceString: "ref: 'v3.0.0'",
        },
      ]);
    });

    it('extracts digest-pinned refs with tag or branch comments', () => {
      const content = codeBlock`
        include:
          - project: "my-org/pinned-tag"
            ref: "${sha1}"  # v2.0.0
            file: "scan.yml"
          - project: my-org/pinned-branch
            ref: ${sha1} # main
            file: build.yml
          - project: my-org/pinned-sha256
            ref: '${sha256}' # v1.2.3 # trailing note
            file: release.yml
      `;

      const res = extractPackageFile(content);

      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            'ref: "{{#if newDigest}}{{newDigest}}"{{#if newValue}}  # {{newValue}}{{/if}}{{else}}{{newValue}}"{{/if}}',
          currentDigest: sha1,
          currentValue: 'v2.0.0',
          datasource: 'gitlab-tags',
          depName: 'my-org/pinned-tag',
          depType: 'repository',
          replaceString: `ref: "${sha1}"  # v2.0.0`,
        },
        {
          autoReplaceStringTemplate:
            'ref: {{#if newDigest}}{{newDigest}}{{#if newValue}} # {{newValue}}{{/if}}{{else}}{{newValue}}{{/if}}',
          currentDigest: sha1,
          currentValue: 'main',
          datasource: 'gitlab-tags',
          depName: 'my-org/pinned-branch',
          depType: 'repository',
          replaceString: `ref: ${sha1} # main`,
        },
        {
          autoReplaceStringTemplate:
            "ref: '{{#if newDigest}}{{newDigest}}'{{#if newValue}} # {{newValue}}{{/if}}{{else}}{{newValue}}'{{/if}}",
          currentDigest: sha256,
          currentValue: 'v1.2.3',
          datasource: 'gitlab-tags',
          depName: 'my-org/pinned-sha256',
          depType: 'repository',
          replaceString: `ref: '${sha256}' # v1.2.3`,
        },
      ]);
    });

    it('skips bare commit SHAs without a recognizable ref comment', () => {
      const content = codeBlock`
        include:
          - project: my-org/bare-sha
            ref: ${sha1}
            file: scan.yml
          - project: my-org/prose-comment-sha
            ref: "${sha1}" # pinned for security
            file: build.yml
      `;

      const res = extractPackageFile(content);

      expect(res?.deps).toEqual([
        {
          currentDigest: sha1,
          datasource: 'gitlab-tags',
          depName: 'my-org/bare-sha',
          depType: 'repository',
          skipReason: 'unversioned-reference',
        },
        {
          currentDigest: sha1,
          datasource: 'gitlab-tags',
          depName: 'my-org/prose-comment-sha',
          depType: 'repository',
          skipReason: 'unversioned-reference',
        },
      ]);
    });

    it('disables digest pinning for flow mappings and block scalars', () => {
      const content = codeBlock`
        include:
          - { project: "my-org/flow-tag", ref: "v1.0.0", file: "a.yml" }
          - { project: "my-org/flow-sha", ref: "${sha1}", file: "b.yml" }
          - project: my-org/block-scalar
            ref: |-
              v2.0.0
            file: c.yml
      `;

      const res = extractPackageFile(content);

      expect(res?.deps).toEqual([
        {
          currentValue: 'v1.0.0',
          datasource: 'gitlab-tags',
          depName: 'my-org/flow-tag',
          depType: 'repository',
          pinDigests: false,
        },
        {
          currentDigest: sha1,
          datasource: 'gitlab-tags',
          depName: 'my-org/flow-sha',
          depType: 'repository',
          skipReason: 'unversioned-reference',
        },
        {
          currentValue: 'v2.0.0',
          datasource: 'gitlab-tags',
          depName: 'my-org/block-scalar',
          depType: 'repository',
          pinDigests: false,
        },
      ]);
    });

    it('resolves YAML aliases and ignores non-scalar map keys', () => {
      const content = codeBlock`
        .shared-include: &shared
          project: my-org/aliased-project
          ref: "v1.0.0"
          file: scan.yml

        include:
          - *shared
          - [complex-key]: ignored
            project: my-org/complex-key-project
            ref: v2.0.0
      `;

      const res = extractPackageFile(content);

      expect(res?.deps).toMatchObject([
        {
          currentValue: 'v1.0.0',
          depName: 'my-org/aliased-project',
          replaceString: 'ref: "v1.0.0"',
        },
        {
          currentValue: 'v2.0.0',
          depName: 'my-org/complex-key-project',
          replaceString: 'ref: v2.0.0',
        },
      ]);
    });
  });
});
