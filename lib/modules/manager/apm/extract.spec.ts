import { codeBlock } from 'common-tags';
import { describe, expect, it } from 'vitest';
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
            autoReplaceStringTemplate: '{{depName}}#{{newValue}}',
          },
        ],
      });
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
          autoReplaceStringTemplate: '{{depName}}#{{newValue}}',
        },
      ]);
    });
  });
});
