import { codeBlock } from 'common-tags';
import { describe, expect, it } from 'vitest';
import { regEx } from '../../../util/regex.ts';
import { ApmDatasource } from '../../datasource/apm/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { extractPackageFile } from './extract.ts';

const packageFile = 'apm.yml';

describe('modules/manager/apm/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid YAML', () => {
      expect(extractPackageFile('foo: *bar', packageFile)).toBeNull();
    });

    it('returns null when parsed content is not an object', () => {
      expect(extractPackageFile('just a string', packageFile)).toBeNull();
    });

    it('returns null when there are no dependencies', () => {
      const content = codeBlock`
        name: your-project
        version: 1.0.0
      `;
      expect(extractPackageFile(content, packageFile)).toBeNull();
    });

    it('returns null when apm section is not an array', () => {
      const content = codeBlock`
        name: your-project
        dependencies:
          apm: not-an-array
      `;
      expect(extractPackageFile(content, packageFile)).toBeNull();
    });

    it('extracts github dependencies (default host)', () => {
      const content = codeBlock`
        name: your-project
        version: 1.0.0
        dependencies:
          apm:
            - microsoft/apm-sample-package#v1.0.0
      `;
      expect(extractPackageFile(content, packageFile)).toEqual({
        deps: [
          {
            depName: 'microsoft/apm-sample-package',
            depType: 'apm',
            currentValue: 'v1.0.0',
            datasource: GithubTagsDatasource.id,
            packageName: 'microsoft/apm-sample-package',
            replaceString: 'microsoft/apm-sample-package#v1.0.0',
            autoReplaceStringTemplate:
              '{{depName}}#{{#if newDigest}}{{newDigest}} # {{newValue}}{{else}}{{newValue}}{{/if}}',
          },
        ],
      });
    });

    it('parses the SHA-pinned digest form (tag recovered from comment)', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - owner/tool#v1.0.0
            - acme/playbooks#b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123 # v2.0.0
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        { depName: 'owner/tool', currentValue: 'v1.0.0' },
        {
          depName: 'acme/playbooks',
          packageName: 'acme/playbooks',
          datasource: GithubTagsDatasource.id,
          currentDigest: 'b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123',
          currentValue: 'v2.0.0',
          replaceString:
            'acme/playbooks#b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123 # v2.0.0',
        },
      ]);
    });

    it('maps a SHA pinned in both sections to its own line', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - acme/playbooks#b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123 # v2.0.0
        devDependencies:
          apm:
            - acme/playbooks#b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123 # v2.1.0
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          depType: 'apm',
          currentValue: 'v2.0.0',
          replaceString:
            'acme/playbooks#b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123 # v2.0.0',
        },
        {
          depType: 'apm-dev',
          currentValue: 'v2.1.0',
          replaceString:
            'acme/playbooks#b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123 # v2.1.0',
        },
      ]);
    });

    it('emits a digest dep for a SHA pin on a git-tags host', () => {
      // git-tags resolves digests via `git ls-remote`, so the SHA is preserved
      // on a bump rather than dropped to a digest-less tag.
      const content = codeBlock`
        dependencies:
          apm:
            - bitbucket.org/team/project#b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123 # v2.0.0
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          depName: 'bitbucket.org/team/project',
          packageName: 'https://bitbucket.org/team/project',
          datasource: GitTagsDatasource.id,
          currentDigest: 'b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123',
          currentValue: 'v2.0.0',
        },
      ]);
    });

    it('skips a bare SHA with no tag comment', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - acme/playbooks#b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          depName: 'acme/playbooks',
          currentDigest: 'b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123',
          skipReason: 'unversioned-reference',
        },
      ]);
    });

    it('skips a quoted SHA-pin (exact text not recoverable)', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - "acme/playbooks#b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123" # v2.0.0
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          depName: 'acme/playbooks',
          currentDigest: 'b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123',
          skipReason: 'unversioned-reference',
        },
      ]);
    });

    it('keeps subpath in depName but uses owner/repo as packageName', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - anthropics/skills/skills/frontend-design#v1.2.3
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          depName: 'anthropics/skills/skills/frontend-design',
          packageName: 'anthropics/skills',
          datasource: GithubTagsDatasource.id,
          currentValue: 'v1.2.3',
        },
      ]);
    });

    it('handles dots in repo names and subpaths', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - owner/repo.js#v1.0.0
            - github/awesome-copilot/agents/api-architect.agent.md#v2.0.0
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          depName: 'owner/repo.js',
          packageName: 'owner/repo.js',
          datasource: GithubTagsDatasource.id,
          currentValue: 'v1.0.0',
        },
        {
          depName: 'github/awesome-copilot/agents/api-architect.agent.md',
          packageName: 'github/awesome-copilot',
          datasource: GithubTagsDatasource.id,
          currentValue: 'v2.0.0',
        },
      ]);
    });

    it('extracts gitlab.com dependencies', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - gitlab.com/team/project#v2.3.0
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          depName: 'gitlab.com/team/project',
          packageName: 'team/project',
          datasource: GitlabTagsDatasource.id,
          currentValue: 'v2.3.0',
        },
      ]);
      expect(
        extractPackageFile(content, packageFile)?.deps[0].registryUrls,
      ).toBeUndefined();
    });

    it('supports GitLab nested groups (project slug spans 3+ segments)', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - gitlab.com/group/subgroup/project#v1.0.0
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          depName: 'gitlab.com/group/subgroup/project',
          packageName: 'group/subgroup/project',
          datasource: GitlabTagsDatasource.id,
          currentValue: 'v1.0.0',
        },
      ]);
    });

    it('splits a GitLab nested project from a virtual subpath', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - gitlab.com/group/subgroup/project/prompts/foo#v1.0.0
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          depName: 'gitlab.com/group/subgroup/project/prompts/foo',
          packageName: 'group/subgroup/project',
          datasource: GitlabTagsDatasource.id,
          currentValue: 'v1.0.0',
        },
      ]);
    });

    it('treats a GitLab .chatmode.md virtual file as a subpath boundary', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - gitlab.com/group/subgroup/project/my.chatmode.md#v1.0.0
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          depName: 'gitlab.com/group/subgroup/project/my.chatmode.md',
          packageName: 'group/subgroup/project',
          datasource: GitlabTagsDatasource.id,
          currentValue: 'v1.0.0',
        },
      ]);
    });

    it('extracts self-hosted github dependencies with registryUrls', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - github.example.com/team/project#v1.0.0
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          packageName: 'team/project',
          datasource: GithubTagsDatasource.id,
          registryUrls: ['https://github.example.com'],
        },
      ]);
    });

    it('extracts self-hosted gitlab dependencies with registryUrls', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - gitlab.example.com/team/project#v1.0.0
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          packageName: 'team/project',
          datasource: GitlabTagsDatasource.id,
          registryUrls: ['https://gitlab.example.com'],
        },
      ]);
    });

    it('falls back to git-tags for other hosts', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - bitbucket.org/team/project#v1.0.0
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          depName: 'bitbucket.org/team/project',
          packageName: 'https://bitbucket.org/team/project',
          datasource: GitTagsDatasource.id,
          currentValue: 'v1.0.0',
        },
      ]);
    });

    it('skips unpinned dependencies', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - anthropics/skills/skills/frontend-design
            - owner/repo#
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          depName: 'anthropics/skills/skills/frontend-design',
          skipReason: 'unspecified-version',
        },
        {
          depName: 'owner/repo',
          skipReason: 'unspecified-version',
        },
      ]);
    });

    it('marks entries without owner/repo as invalid', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - foo#v1.0.0
            - gitlab.com/foo#v1.0.0
            - '#v1.0.0'
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          depName: 'foo',
          currentValue: 'v1.0.0',
          skipReason: 'invalid-dependency-specification',
        },
        {
          depName: 'gitlab.com/foo',
          currentValue: 'v1.0.0',
          skipReason: 'invalid-dependency-specification',
        },
        {
          depName: '',
          currentValue: 'v1.0.0',
          skipReason: 'invalid-dependency-specification',
        },
      ]);
    });

    it('extracts devDependencies with apm-dev depType', () => {
      const content = codeBlock`
        devDependencies:
          apm:
            - owner/repo#v1.2.3
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          depName: 'owner/repo',
          depType: 'apm-dev',
          currentValue: 'v1.2.3',
        },
      ]);
    });

    it('ignores MCP entries and non-string entries', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - owner/repo#v1.0.0
            - name: nested-object-should-be-skipped
          mcp:
            - name: io.github.github/github-mcp-server
              transport: http
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toEqual([
        {
          depName: 'owner/repo',
          depType: 'apm',
          currentValue: 'v1.0.0',
          datasource: GithubTagsDatasource.id,
          packageName: 'owner/repo',
          replaceString: 'owner/repo#v1.0.0',
          autoReplaceStringTemplate:
            '{{depName}}#{{#if newDigest}}{{newDigest}} # {{newValue}}{{else}}{{newValue}}{{/if}}',
        },
      ]);
    });
  });

  describe('per-package tags', () => {
    it.each`
      ref                    | compatibility    | version
      ${'foo--v1.0.0'}       | ${'foo--'}       | ${'1.0.0'}
      ${'foo-v1.0.0'}        | ${'foo-'}        | ${'1.0.0'}
      ${'foo_v1.0.0'}        | ${'foo_'}        | ${'1.0.0'}
      ${'my-plugin--v1.0.0'} | ${'my-plugin--'} | ${'1.0.0'}
      ${'my-plugin-v1.0.0'}  | ${'my-plugin-'}  | ${'1.0.0'}
      ${'foo--v1.2.0-rc.1'}  | ${'foo--'}       | ${'1.2.0-rc.1'}
    `(
      'scopes $ref to tags of the same package',
      ({ ref, compatibility, version }) => {
        const content = codeBlock`
          dependencies:
            apm:
              - owner/repo/plugins/foo#${ref}
        `;

        const dep = extractPackageFile(content, packageFile)?.deps[0];

        expect(dep).toMatchObject({ currentValue: ref });
        expect(
          regEx(dep!.versionCompatibility!).exec(ref)?.groups,
        ).toMatchObject({ compatibility, version });
      },
    );

    it.each`
      ref
      ${'v1.2.3'}
      ${'1.2.3'}
      ${'v1.2.3-beta.1'}
      ${'main'}
      ${'foo-v1'}
      ${'foo@1.2.3'}
    `('leaves $ref compared as-is', ({ ref }) => {
      const content = codeBlock`
        dependencies:
          apm:
            - owner/repo#${ref}
      `;

      const dep = extractPackageFile(content, packageFile)?.deps[0];

      expect(dep).toMatchObject({ currentValue: ref });
      expect(dep).not.toHaveProperty('versionCompatibility');
    });

    it('scopes a SHA pin by the tag in its comment', () => {
      const content = codeBlock`
        dependencies:
          apm:
            - owner/repo/plugins/foo#b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123 # foo--v1.0.0
      `;

      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          currentValue: 'foo--v1.0.0',
          currentDigest: 'b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123',
          versionCompatibility: expect.any(String),
        },
      ]);
    });
  });

  describe('registries', () => {
    const registryUrl =
      'https://artifactory.example.com/artifactory/api/agentpackages/apm-local';

    it('routes shorthand entries to the default registry', () => {
      const content = codeBlock`
        registries:
          corp-main:
            url: ${registryUrl}
          default: corp-main
        dependencies:
          apm:
            - acme/code-review-prompts#^2.0.0
            - gitlab.com/acme/web-skills#1.4.0
            - acme/prompt-library/prompts/code-review.prompt.md#stable
        devDependencies:
          apm:
            - acme/dev-tools#~1.2.0
      `;
      expect(extractPackageFile(content, packageFile)).toEqual({
        deps: [
          {
            depName: 'acme/code-review-prompts',
            depType: 'apm',
            datasource: ApmDatasource.id,
            packageName: 'acme/code-review-prompts',
            registryUrls: [registryUrl],
            currentValue: '^2.0.0',
            replaceString: 'acme/code-review-prompts#^2.0.0',
            autoReplaceStringTemplate:
              '{{depName}}#{{#if newDigest}}{{newDigest}} # {{newValue}}{{else}}{{newValue}}{{/if}}',
          },
          {
            depName: 'gitlab.com/acme/web-skills',
            depType: 'apm',
            datasource: ApmDatasource.id,
            packageName: 'gitlab.com/acme/web-skills',
            registryUrls: [registryUrl],
            currentValue: '1.4.0',
            replaceString: 'gitlab.com/acme/web-skills#1.4.0',
            autoReplaceStringTemplate:
              '{{depName}}#{{#if newDigest}}{{newDigest}} # {{newValue}}{{else}}{{newValue}}{{/if}}',
          },
          {
            depName: 'acme/prompt-library/prompts/code-review.prompt.md',
            depType: 'apm',
            datasource: ApmDatasource.id,
            packageName: 'acme/prompt-library',
            registryUrls: [registryUrl],
            currentValue: 'stable',
            replaceString:
              'acme/prompt-library/prompts/code-review.prompt.md#stable',
            autoReplaceStringTemplate:
              '{{depName}}#{{#if newDigest}}{{newDigest}} # {{newValue}}{{else}}{{newValue}}{{/if}}',
          },
          {
            depName: 'acme/dev-tools',
            depType: 'apm-dev',
            datasource: ApmDatasource.id,
            packageName: 'acme/dev-tools',
            registryUrls: [registryUrl],
            currentValue: '~1.2.0',
            replaceString: 'acme/dev-tools#~1.2.0',
            autoReplaceStringTemplate:
              '{{depName}}#{{#if newDigest}}{{newDigest}} # {{newValue}}{{else}}{{newValue}}{{/if}}',
          },
        ],
      });
    });

    it('still skips unpinned and invalid shorthand entries', () => {
      const content = codeBlock`
        registries:
          corp-main:
            url: ${registryUrl}
          default: corp-main
        dependencies:
          apm:
            - acme/foo
            - foo#1.0.0
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        { depName: 'acme/foo', skipReason: 'unspecified-version' },
        {
          depName: 'foo',
          currentValue: '1.0.0',
          skipReason: 'invalid-dependency-specification',
        },
      ]);
    });

    it('extracts object-form registry entries', () => {
      const content = codeBlock`
        registries:
          corp-main:
            url: ${registryUrl}
          corp-snapshots:
            url: https://artifactory.example.com/artifactory/api/agentpackages/apm-snapshots
          default: corp-main
        dependencies:
          apm:
            - id: acme/toolkit
              version: ^2.0.0
            - registry: corp-snapshots
              id: acme/toolkit
              version: "2.1.0-rc.1"
            - registry: corp-main
              id: acme/prompt-library
              path: prompts/code-review.prompt.md
              version: 1.4.0
              alias: code-review
      `;
      expect(extractPackageFile(content, packageFile)).toEqual({
        deps: [
          {
            depName: 'acme/toolkit',
            depType: 'apm',
            datasource: ApmDatasource.id,
            packageName: 'acme/toolkit',
            registryUrls: [registryUrl],
            currentValue: '^2.0.0',
            replaceString: '^2.0.0',
            autoReplaceStringTemplate: '{{{newValue}}}',
          },
          {
            depName: 'acme/toolkit',
            depType: 'apm',
            datasource: ApmDatasource.id,
            packageName: 'acme/toolkit',
            registryUrls: [
              'https://artifactory.example.com/artifactory/api/agentpackages/apm-snapshots',
            ],
            currentValue: '2.1.0-rc.1',
            replaceString: '2.1.0-rc.1',
            autoReplaceStringTemplate: '{{{newValue}}}',
          },
          {
            depName: 'acme/prompt-library',
            depType: 'apm',
            datasource: ApmDatasource.id,
            packageName: 'acme/prompt-library',
            registryUrls: [registryUrl],
            currentValue: '1.4.0',
            replaceString: '1.4.0',
            autoReplaceStringTemplate: '{{{newValue}}}',
          },
        ],
      });
    });

    it('skips entries whose registry url is not declared', () => {
      const content = codeBlock`
        registries:
          corp-main:
            url: ${registryUrl}
          default: config-only
        dependencies:
          apm:
            - acme/foo#1.0.0
            - registry: corp-other
              id: acme/bar
              version: 1.0.0
            - id: acme/baz
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          depName: 'acme/foo',
          datasource: ApmDatasource.id,
          currentValue: '1.0.0',
          skipReason: 'unknown-registry',
        },
        {
          depName: 'acme/bar',
          datasource: ApmDatasource.id,
          currentValue: '1.0.0',
          skipReason: 'unknown-registry',
        },
        { depName: 'acme/baz', skipReason: 'unspecified-version' },
      ]);
    });

    it('keeps shorthand entries on git when no default registry is set', () => {
      const content = codeBlock`
        registries:
          corp-main:
            url: ${registryUrl}
        dependencies:
          apm:
            - acme/foo#v1.0.0
            - id: acme/bar
              version: 1.0.0
            - registry: corp-main
              id: acme/baz
              version: 1.0.0
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        {
          depName: 'acme/foo',
          datasource: GithubTagsDatasource.id,
          currentValue: 'v1.0.0',
        },
        { depName: 'acme/bar', skipReason: 'unknown-registry' },
        {
          depName: 'acme/baz',
          datasource: ApmDatasource.id,
          registryUrls: [registryUrl],
        },
      ]);
    });

    it('ignores a malformed registries block', () => {
      const content = codeBlock`
        registries: corp-main
        dependencies:
          apm:
            - acme/foo#v1.0.0
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        { depName: 'acme/foo', datasource: GithubTagsDatasource.id },
      ]);
    });

    it('ignores registry entries without a url and a blank default', () => {
      const content = codeBlock`
        registries:
          corp-main: ${registryUrl}
          corp-other:
            url: ''
          default: ''
        dependencies:
          apm:
            - acme/foo#v1.0.0
      `;
      expect(extractPackageFile(content, packageFile)?.deps).toMatchObject([
        { depName: 'acme/foo', datasource: GithubTagsDatasource.id },
      ]);
    });
  });
});
