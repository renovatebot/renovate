import { codeBlock } from 'common-tags';
import { describe, expect, it, vi } from 'vitest';
import { fs } from '~test/util.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { extractPackageFile } from './extract.ts';

vi.mock('../../../util/fs/index.ts');

const packageFile = 'apm.yml';

const manifest = codeBlock`
  name: some-skill
  version: 1.0.0
  dependencies:
    apm:
      - owner/repo#v1.0.0
`;

const lockFile = codeBlock`
  lockfile_version: '1'
  dependencies:
  - repo_url: owner/skills
    deployed_files:
    - .claude/skills/some-skill
    - .claude/skills/some-skill/SKILL.md
    - .claude/skills/some-skill/apm.yml
`;

describe('modules/manager/apm/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid YAML', async () => {
      await expect(
        extractPackageFile('foo: *bar', packageFile),
      ).resolves.toBeNull();
    });

    it('returns null when parsed content is not an object', async () => {
      await expect(
        extractPackageFile('just a string', packageFile),
      ).resolves.toBeNull();
    });

    it('returns null when there are no dependencies', async () => {
      const content = codeBlock`
        name: your-project
        version: 1.0.0
      `;
      await expect(
        extractPackageFile(content, packageFile),
      ).resolves.toBeNull();
    });

    it('returns null when apm section is not an array', async () => {
      const content = codeBlock`
        name: your-project
        dependencies:
          apm: not-an-array
      `;
      await expect(
        extractPackageFile(content, packageFile),
      ).resolves.toBeNull();
    });

    it('extracts github dependencies (default host)', async () => {
      const content = codeBlock`
        name: your-project
        version: 1.0.0
        dependencies:
          apm:
            - microsoft/apm-sample-package#v1.0.0
      `;
      await expect(extractPackageFile(content, packageFile)).resolves.toEqual({
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

    it('parses the SHA-pinned digest form (tag recovered from comment)', async () => {
      const content = codeBlock`
        dependencies:
          apm:
            - owner/tool#v1.0.0
            - acme/playbooks#b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123 # v2.0.0
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
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

    it('maps a SHA pinned in both sections to its own line', async () => {
      const content = codeBlock`
        dependencies:
          apm:
            - acme/playbooks#b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123 # v2.0.0
        devDependencies:
          apm:
            - acme/playbooks#b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123 # v2.1.0
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
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

    it('emits a digest dep for a SHA pin on a git-tags host', async () => {
      // git-tags resolves digests via `git ls-remote`, so the SHA is preserved
      // on a bump rather than dropped to a digest-less tag.
      const content = codeBlock`
        dependencies:
          apm:
            - bitbucket.org/team/project#b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123 # v2.0.0
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
        {
          depName: 'bitbucket.org/team/project',
          packageName: 'https://bitbucket.org/team/project',
          datasource: GitTagsDatasource.id,
          currentDigest: 'b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123',
          currentValue: 'v2.0.0',
        },
      ]);
    });

    it('skips a bare SHA with no tag comment', async () => {
      const content = codeBlock`
        dependencies:
          apm:
            - acme/playbooks#b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
        {
          depName: 'acme/playbooks',
          currentDigest: 'b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123',
          skipReason: 'unversioned-reference',
        },
      ]);
    });

    it('skips a quoted SHA-pin (exact text not recoverable)', async () => {
      const content = codeBlock`
        dependencies:
          apm:
            - "acme/playbooks#b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123" # v2.0.0
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
        {
          depName: 'acme/playbooks',
          currentDigest: 'b1c2d3e4f5a6b7c8d9e0f1234567890abcdef123',
          skipReason: 'unversioned-reference',
        },
      ]);
    });

    it('keeps subpath in depName but uses owner/repo as packageName', async () => {
      const content = codeBlock`
        dependencies:
          apm:
            - anthropics/skills/skills/frontend-design#v1.2.3
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
        {
          depName: 'anthropics/skills/skills/frontend-design',
          packageName: 'anthropics/skills',
          datasource: GithubTagsDatasource.id,
          currentValue: 'v1.2.3',
        },
      ]);
    });

    it('handles dots in repo names and subpaths', async () => {
      const content = codeBlock`
        dependencies:
          apm:
            - owner/repo.js#v1.0.0
            - github/awesome-copilot/agents/api-architect.agent.md#v2.0.0
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
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

    it('extracts gitlab.com dependencies', async () => {
      const content = codeBlock`
        dependencies:
          apm:
            - gitlab.com/team/project#v2.3.0
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
        {
          depName: 'gitlab.com/team/project',
          packageName: 'team/project',
          datasource: GitlabTagsDatasource.id,
          currentValue: 'v2.3.0',
        },
      ]);
      expect(
        (await extractPackageFile(content, packageFile))?.deps[0].registryUrls,
      ).toBeUndefined();
    });

    it('supports GitLab nested groups (project slug spans 3+ segments)', async () => {
      const content = codeBlock`
        dependencies:
          apm:
            - gitlab.com/group/subgroup/project#v1.0.0
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
        {
          depName: 'gitlab.com/group/subgroup/project',
          packageName: 'group/subgroup/project',
          datasource: GitlabTagsDatasource.id,
          currentValue: 'v1.0.0',
        },
      ]);
    });

    it('splits a GitLab nested project from a virtual subpath', async () => {
      const content = codeBlock`
        dependencies:
          apm:
            - gitlab.com/group/subgroup/project/prompts/foo#v1.0.0
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
        {
          depName: 'gitlab.com/group/subgroup/project/prompts/foo',
          packageName: 'group/subgroup/project',
          datasource: GitlabTagsDatasource.id,
          currentValue: 'v1.0.0',
        },
      ]);
    });

    it('treats a GitLab .chatmode.md virtual file as a subpath boundary', async () => {
      const content = codeBlock`
        dependencies:
          apm:
            - gitlab.com/group/subgroup/project/my.chatmode.md#v1.0.0
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
        {
          depName: 'gitlab.com/group/subgroup/project/my.chatmode.md',
          packageName: 'group/subgroup/project',
          datasource: GitlabTagsDatasource.id,
          currentValue: 'v1.0.0',
        },
      ]);
    });

    it('extracts self-hosted github dependencies with registryUrls', async () => {
      const content = codeBlock`
        dependencies:
          apm:
            - github.example.com/team/project#v1.0.0
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
        {
          packageName: 'team/project',
          datasource: GithubTagsDatasource.id,
          registryUrls: ['https://github.example.com'],
        },
      ]);
    });

    it('extracts self-hosted gitlab dependencies with registryUrls', async () => {
      const content = codeBlock`
        dependencies:
          apm:
            - gitlab.example.com/team/project#v1.0.0
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
        {
          packageName: 'team/project',
          datasource: GitlabTagsDatasource.id,
          registryUrls: ['https://gitlab.example.com'],
        },
      ]);
    });

    it('falls back to git-tags for other hosts', async () => {
      const content = codeBlock`
        dependencies:
          apm:
            - bitbucket.org/team/project#v1.0.0
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
        {
          depName: 'bitbucket.org/team/project',
          packageName: 'https://bitbucket.org/team/project',
          datasource: GitTagsDatasource.id,
          currentValue: 'v1.0.0',
        },
      ]);
    });

    it('skips unpinned dependencies', async () => {
      const content = codeBlock`
        dependencies:
          apm:
            - anthropics/skills/skills/frontend-design
            - owner/repo#
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
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

    it('marks entries without owner/repo as invalid', async () => {
      const content = codeBlock`
        dependencies:
          apm:
            - foo#v1.0.0
            - gitlab.com/foo#v1.0.0
            - '#v1.0.0'
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
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

    it('extracts devDependencies with apm-dev depType', async () => {
      const content = codeBlock`
        devDependencies:
          apm:
            - owner/repo#v1.2.3
      `;
      expect(
        (await extractPackageFile(content, packageFile))?.deps,
      ).toMatchObject([
        {
          depName: 'owner/repo',
          depType: 'apm-dev',
          currentValue: 'v1.2.3',
        },
      ]);
    });

    it('ignores MCP entries and non-string entries', async () => {
      const content = codeBlock`
        dependencies:
          apm:
            - owner/repo#v1.0.0
            - name: nested-object-should-be-skipped
          mcp:
            - name: io.github.github/github-mcp-server
              transport: http
      `;
      expect((await extractPackageFile(content, packageFile))?.deps).toEqual([
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

    it('skips a copy that a parent apm.lock.yaml lists as deployed', async () => {
      fs.readLocalFile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(lockFile);

      await expect(
        extractPackageFile(manifest, '.claude/skills/some-skill/apm.yml'),
      ).resolves.toBeNull();
      expect(fs.readLocalFile.mock.calls).toEqual([
        ['.claude/skills/apm.lock.yaml', 'utf8'],
        ['.claude/apm.lock.yaml', 'utf8'],
        ['apm.lock.yaml', 'utf8'],
      ]);
    });

    it('resolves deployed files against the lockfile directory', async () => {
      fs.readLocalFile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(lockFile);

      await expect(
        extractPackageFile(
          manifest,
          'project/.claude/skills/some-skill/apm.yml',
        ),
      ).resolves.toBeNull();
      expect(fs.readLocalFile).toHaveBeenLastCalledWith(
        'project/apm.lock.yaml',
        'utf8',
      );
    });

    it('extracts a project that a parent apm.lock.yaml does not list', async () => {
      fs.readLocalFile.mockResolvedValueOnce(lockFile);

      expect(
        (await extractPackageFile(manifest, 'project/apm.yml'))?.deps,
      ).toMatchObject([{ depName: 'owner/repo', currentValue: 'v1.0.0' }]);
      expect(fs.readLocalFile.mock.calls).toEqual([['apm.lock.yaml', 'utf8']]);
    });
  });
});
