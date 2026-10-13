import { codeBlock } from 'common-tags';
import upath from 'upath';
import { fs, partial } from '~test/util.ts';
import { doAutoReplace } from '../../../../../workers/repository/update/branch/auto-replace.ts';
import type { BranchUpgradeConfig } from '../../../../../workers/types.ts';
import { extractPackageFile } from '../../index.ts';
import {
  ModuleExtractor,
  azureDevOpsSshRefMatchRegex,
  bitbucketRefMatchRegex,
  gitTagsRefMatchRegex,
  githubRefMatchRegex,
  hostnameMatchRegex,
} from './modules.ts';

vi.mock('../../../../../util/fs/index.ts');

describe('modules/manager/terraform/extractors/others/modules', () => {
  const extractor = new ModuleExtractor();

  it('return empty array if no module is found', () => {
    const res = extractor.extract({}, [], {});
    expect(res).toBeArrayOfSize(0);
  });

  describe('githubRefMatchRegex', () => {
    it('should split project and tag from source', () => {
      const groups = githubRefMatchRegex.exec(
        'github.com/hashicorp/example?ref=v1.0.0',
      )?.groups;
      const depth = githubRefMatchRegex.exec(
        'github.com/hashicorp/example?depth=1&ref=v1.0.0',
      )?.groups;
      const depth2 = githubRefMatchRegex.exec(
        'github.com/hashicorp/example?ref=v1.0.0&depth=1',
      )?.groups;
      expect(groups).toEqual({
        project: 'hashicorp/example',
        tag: 'v1.0.0',
      });
      expect(depth).toEqual({
        project: 'hashicorp/example',
        tag: 'v1.0.0',
      });
      expect(depth2).toEqual({
        project: 'hashicorp/example',
        tag: 'v1.0.0',
      });
    });

    it('should parse alpha-numeric characters as well as dots, underscores, and dashes in repo names', () => {
      const groups = githubRefMatchRegex.exec(
        'github.com/hashicorp/example.repo-123?ref=v1.0.0',
      )?.groups;
      expect(groups).toEqual({
        project: 'hashicorp/example.repo-123',
        tag: 'v1.0.0',
      });
    });
  });

  describe('gitTagsRefMatchRegex', () => {
    it('should split project and tag from source', () => {
      const http = gitTagsRefMatchRegex.exec(
        'http://github.com/hashicorp/example?ref=v1.0.0',
      )?.groups;
      const https = gitTagsRefMatchRegex.exec(
        'https://github.com/hashicorp/example?ref=v1.0.0',
      )?.groups;
      const ssh = gitTagsRefMatchRegex.exec(
        'ssh://github.com/hashicorp/example?ref=v1.0.0',
      )?.groups;
      const depth = gitTagsRefMatchRegex.exec(
        'ssh://github.com/hashicorp/example?depth=1&ref=v1.0.0',
      )?.groups;
      const depth2 = gitTagsRefMatchRegex.exec(
        'ssh://github.com/hashicorp/example?ref=v1.0.0&depth=1',
      )?.groups;
      const folder = gitTagsRefMatchRegex.exec(
        'git::ssh://git@git.example.com/modules/foo-module.git//bar?depth=1&ref=v1.0.0',
      )?.groups;
      const folderColonStartedRepo = gitTagsRefMatchRegex.exec(
        'git::ssh://git@git.example.com:modules/foo-module.git//bar?depth=1&ref=v1.0.0',
      )?.groups;

      expect(http).toMatchObject({
        project: 'hashicorp/example',
        tag: 'v1.0.0',
      });
      expect(https).toMatchObject({
        project: 'hashicorp/example',
        tag: 'v1.0.0',
      });
      expect(ssh).toMatchObject({
        project: 'hashicorp/example',
        tag: 'v1.0.0',
      });
      expect(depth).toMatchObject({
        project: 'hashicorp/example',
        tag: 'v1.0.0',
      });
      expect(depth2).toMatchObject({
        project: 'hashicorp/example',
        tag: 'v1.0.0',
      });
      expect(folder).toMatchObject({
        project: 'modules/foo-module.git',
        tag: 'v1.0.0',
      });
      expect(folderColonStartedRepo).toMatchObject({
        project: 'modules/foo-module.git',
        tag: 'v1.0.0',
      });
    });

    it('should parse alpha-numeric characters as well as dots, underscores, and dashes in repo names', () => {
      const http = gitTagsRefMatchRegex.exec(
        'http://github.com/hashicorp/example.repo-123?ref=v1.0.0',
      )?.groups;
      const https = gitTagsRefMatchRegex.exec(
        'https://github.com/hashicorp/example.repo-123?ref=v1.0.0',
      )?.groups;
      const ssh = gitTagsRefMatchRegex.exec(
        'ssh://github.com/hashicorp/example.repo-123?ref=v1.0.0',
      )?.groups;
      const withoutSshHttpHttps = gitTagsRefMatchRegex.exec(
        'git@my-gitlab-instance.local:devops/terraform/instance.git?ref=v5.0.0',
      )?.groups;
      const folder = gitTagsRefMatchRegex.exec(
        'git@my-gitlab-instance.local/devops/terraform/instance.git//submodule?ref=v5.0.0',
      )?.groups;
      const folderColonStartedRepo = gitTagsRefMatchRegex.exec(
        'git@my-gitlab-instance.local:devops/terraform/instance.git//submodule?ref=v5.0.0',
      )?.groups;

      expect(http).toMatchObject({
        project: 'hashicorp/example.repo-123',
        tag: 'v1.0.0',
      });
      expect(https).toMatchObject({
        project: 'hashicorp/example.repo-123',
        tag: 'v1.0.0',
      });
      expect(ssh).toMatchObject({
        project: 'hashicorp/example.repo-123',
        tag: 'v1.0.0',
      });
      expect(withoutSshHttpHttps).toMatchObject({
        project: 'devops/terraform/instance.git',
        tag: 'v5.0.0',
      });
      expect(folder).toMatchObject({
        project: 'devops/terraform/instance.git',
        tag: 'v5.0.0',
      });
      expect(folderColonStartedRepo).toMatchObject({
        project: 'devops/terraform/instance.git',
        tag: 'v5.0.0',
      });
    });
  });

  describe('bitbucketRefMatchRegex', () => {
    it('should split workspace, project and tag from source', () => {
      const ssh = bitbucketRefMatchRegex.exec(
        'git::ssh://git@bitbucket.org/hashicorp/example.git?ref=v1.0.0',
      )?.groups;
      const https = bitbucketRefMatchRegex.exec(
        'git::https://git@bitbucket.org/hashicorp/example.git?ref=v1.0.0',
      )?.groups;
      const plain = bitbucketRefMatchRegex.exec(
        'bitbucket.org/hashicorp/example.git?ref=v1.0.0',
      )?.groups;
      const subfolder = bitbucketRefMatchRegex.exec(
        'bitbucket.org/hashicorp/example.git/terraform?ref=v1.0.0',
      )?.groups;
      const subfolderWithDoubleSlash = bitbucketRefMatchRegex.exec(
        'bitbucket.org/hashicorp/example.git//terraform?ref=v1.0.0',
      )?.groups;
      const subfolderWithGitInName = bitbucketRefMatchRegex.exec(
        'bitbucket.org/hashicorp/example.git//terraform-git?ref=v1.0.0',
      )?.groups;
      const depth = bitbucketRefMatchRegex.exec(
        'git::https://git@bitbucket.org/hashicorp/example.git?depth=1&ref=v1.0.0',
      )?.groups;
      const depth2 = bitbucketRefMatchRegex.exec(
        'git::https://git@bitbucket.org/hashicorp/example.git?ref=v1.0.0&depth=1',
      )?.groups;

      expect(ssh).toMatchObject({
        workspace: 'hashicorp',
        project: 'example',
        tag: 'v1.0.0',
      });
      expect(https).toMatchObject({
        workspace: 'hashicorp',
        project: 'example',
        tag: 'v1.0.0',
      });
      expect(plain).toMatchObject({
        workspace: 'hashicorp',
        project: 'example',
        tag: 'v1.0.0',
      });
      expect(subfolder).toMatchObject({
        workspace: 'hashicorp',
        project: 'example',
        tag: 'v1.0.0',
      });
      expect(subfolderWithDoubleSlash).toMatchObject({
        workspace: 'hashicorp',
        project: 'example',
        tag: 'v1.0.0',
      });
      expect(subfolderWithGitInName).toMatchObject({
        workspace: 'hashicorp',
        project: 'example',
        tag: 'v1.0.0',
      });
      expect(depth).toMatchObject({
        workspace: 'hashicorp',
        project: 'example',
        tag: 'v1.0.0',
      });
      expect(depth2).toMatchObject({
        workspace: 'hashicorp',
        project: 'example',
        tag: 'v1.0.0',
      });
    });

    it('should parse alpha-numeric characters as well as dots, underscores, and dashes in repo names', () => {
      const dots = bitbucketRefMatchRegex.exec(
        'bitbucket.org/hashicorp/example.repo-123.git?ref=v1.0.0',
      )?.groups;

      expect(dots).toMatchObject({
        workspace: 'hashicorp',
        project: 'example.repo-123',
        tag: 'v1.0.0',
      });
    });
  });

  describe('azureDevOpsSshRefMatchRegex', () => {
    it('should split organization, project, repository and tag from source url', () => {
      const ssh = azureDevOpsSshRefMatchRegex.exec(
        'git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository?ref=1.0.0',
      )?.groups;

      expect(ssh).toEqual({
        modulepath: '',
        organization: 'MyOrg',
        project: 'MyProject',
        repository: 'MyRepository',
        tag: '1.0.0',
        url: 'git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository',
      });
    });

    it('should split organization, project, repository and tag from source url with git prefix', () => {
      const sshGit = azureDevOpsSshRefMatchRegex.exec(
        'git::git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository?ref=1.0.0',
      )?.groups;

      expect(sshGit).toEqual({
        modulepath: '',
        organization: 'MyOrg',
        project: 'MyProject',
        repository: 'MyRepository',
        tag: '1.0.0',
        url: 'git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository',
      });
    });

    it('should split organization, project, repository and tag from source url with subfolder', () => {
      const subfolder = azureDevOpsSshRefMatchRegex.exec(
        'git::git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository//some-module/path?ref=1.0.0',
      )?.groups;

      expect(subfolder).toEqual({
        modulepath: '//some-module/path',
        organization: 'MyOrg',
        project: 'MyProject',
        repository: 'MyRepository',
        tag: '1.0.0',
        url: 'git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository',
      });
    });

    it('should split organization, project, repository and tag from source url with depth argument', () => {
      const depth = azureDevOpsSshRefMatchRegex.exec(
        'git::git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository//some-module/path?depth=1&ref=1.0.0',
      )?.groups;
      const depth2 = azureDevOpsSshRefMatchRegex.exec(
        'git::git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository//some-module/path?ref=1.0.0&depth=1',
      )?.groups;

      expect(depth).toEqual({
        modulepath: '//some-module/path',
        organization: 'MyOrg',
        project: 'MyProject',
        repository: 'MyRepository',
        tag: '1.0.0',
        url: 'git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository',
      });
      expect(depth2).toEqual({
        modulepath: '//some-module/path',
        organization: 'MyOrg',
        project: 'MyProject',
        repository: 'MyRepository',
        tag: '1.0.0',
        url: 'git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository',
      });
    });

    it('should parse alpha-numeric characters as well as dots, underscores, and dashes in repo names', () => {
      const dots = azureDevOpsSshRefMatchRegex.exec(
        'git::git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository//some-module/path?ref=v1.0.0',
      )?.groups;

      expect(dots).toEqual({
        modulepath: '//some-module/path',
        organization: 'MyOrg',
        project: 'MyProject',
        repository: 'MyRepository',
        tag: 'v1.0.0',
        url: 'git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository',
      });
    });
  });

  describe('hostnameMatchRegex', () => {
    it('should extact hostname from source url', () => {
      const host1 = hostnameMatchRegex.exec(
        'git-lab.git-server.com/my/terraform/module',
      )?.groups;
      const host2 = hostnameMatchRegex.exec(
        'example.com/my/terraform/module',
      )?.groups;

      expect(host1).toEqual({
        hostname: 'git-lab.git-server.com',
      });
      expect(host2).toEqual({
        hostname: 'example.com',
      });
    });
  });

  describe('extract modules using local/variable refs', () => {
    it('resolves a local value used as a github ref', async () => {
      const res = await extractPackageFile(
        codeBlock`
          locals {
            tag = "v1.0.0"
          }

          module "foo" {
            source = "github.com/hashicorp/example?ref=${'$'}{local.tag}"
          }
        `,
        'main.tf',
        {},
      );
      expect(res?.deps).toMatchObject([
        {
          depName: 'github.com/hashicorp/example',
          currentValue: 'v1.0.0',
          datasource: 'github-tags',
        },
      ]);
    });

    it('resolves a const variable default used as a module version', async () => {
      const res = await extractPackageFile(
        codeBlock`
          variable "ver" {
            type    = string
            const   = true
            default = "1.0.0"
          }

          module "foo" {
            source  = "hashicorp/consul/aws"
            version = "${'$'}{var.ver}"
          }
        `,
        'main.tf',
        {},
      );
      expect(res?.deps).toMatchObject([
        {
          depName: 'hashicorp/consul/aws',
          currentValue: '1.0.0',
          datasource: 'terraform-module',
        },
      ]);
    });

    it('skips when the reference cannot be resolved', async () => {
      const res = await extractPackageFile(
        codeBlock`
          module "foo" {
            source = "github.com/hashicorp/example?ref=${'$'}{local.tag}"
          }
        `,
        'main.tf',
        {},
      );
      expect(res?.deps).toMatchObject([
        {
          depName: 'github.com/hashicorp/example',
          skipReason: 'contains-variable',
        },
      ]);
    });

    it('skips when the variable has no default', async () => {
      const res = await extractPackageFile(
        codeBlock`
          variable "tag" {
            const = true
          }

          module "foo" {
            source = "github.com/hashicorp/example?ref=${'$'}{var.tag}"
          }
        `,
        'main.tf',
        {},
      );
      expect(res?.deps).toMatchObject([{ skipReason: 'contains-variable' }]);
    });

    it('skips a chained local', async () => {
      const res = await extractPackageFile(
        codeBlock`
          locals {
            base = "v1.0.0"
            tag  = local.base
          }

          module "foo" {
            source = "github.com/hashicorp/example?ref=${'$'}{local.tag}"
          }
        `,
        'main.tf',
        {},
      );
      expect(res?.deps).toMatchObject([{ skipReason: 'contains-variable' }]);
    });

    it('allows a shared local for modules of the same package', async () => {
      const res = await extractPackageFile(
        codeBlock`
          locals {
            tag = "v1.0.0"
          }

          module "a" {
            source = "github.com/hashicorp/example?ref=${'$'}{local.tag}"
          }

          module "b" {
            source = "github.com/hashicorp/example//sub?ref=${'$'}{local.tag}"
          }
        `,
        'main.tf',
        {},
      );
      expect(res?.deps).toMatchObject([
        { currentValue: 'v1.0.0' },
        { currentValue: 'v1.0.0' },
      ]);
      expect(res?.deps.some((d) => d.skipReason)).toBeFalse();
    });

    it('allows a shared local for git modules of the same repository', async () => {
      const res = await extractPackageFile(
        codeBlock`
          locals {
            tag = "v1.0.0"
          }

          module "a" {
            source = "git::https://example.com/org/repo.git//a?ref=${'$'}{local.tag}"
          }

          module "b" {
            source = "git::https://example.com/org/repo.git//b?ref=${'$'}{local.tag}"
          }
        `,
        'main.tf',
        {},
      );
      expect(res?.deps).toMatchObject([
        { currentValue: 'v1.0.0', datasource: 'git-tags' },
        { currentValue: 'v1.0.0', datasource: 'git-tags' },
      ]);
      expect(res?.deps.some((d) => d.skipReason)).toBeFalse();
    });

    it('skips a shared local used by modules of different packages', async () => {
      const res = await extractPackageFile(
        codeBlock`
          locals {
            tag = "v1.0.0"
          }

          module "a" {
            source = "github.com/hashicorp/example?ref=${'$'}{local.tag}"
          }

          module "b" {
            source = "github.com/hashicorp/other?ref=${'$'}{local.tag}"
          }
        `,
        'main.tf',
        {},
      );
      expect(res?.deps).toMatchObject([
        { skipReason: 'contains-variable' },
        { skipReason: 'contains-variable' },
      ]);
    });

    it.each`
      declaration                                                      | expected
      ${'locals {\n  tag = "v1.0.0"\n}'}                               | ${'locals {\n  tag = "v2.0.0"\n}'}
      ${'variable "tag" {\n  const   = true\n  default = "v1.0.0"\n}'} | ${'variable "tag" {\n  const   = true\n  default = "v2.0.0"\n}'}
    `(
      'updates the declaration and not the source line',
      async ({ declaration, expected }) => {
        const ref = declaration.startsWith('locals') ? 'local' : 'var';
        const module = `module "foo" {\n  source = "github.com/hashicorp/example?ref=\${${ref}.tag}"\n}`;
        const content = `${declaration}\n\n${module}`;
        const res = await extractPackageFile(content, 'main.tf', {});
        const dep = res!.deps[0];
        const updated = await doAutoReplace(
          partial<BranchUpgradeConfig>({
            ...dep,
            manager: 'terraform',
            packageFile: 'main.tf',
            depIndex: 0,
            newValue: 'v2.0.0',
          }),
          content,
          false,
        );
        expect(updated).toBe(`${expected}\n\n${module}`);
      },
    );
  });

  describe('extract modules using local/variable refs declared in other files', () => {
    function ghRef(repo: string, ref: string): string {
      return `module "${repo.replace('/', '_')}" {\n  source = "github.com/${repo}?ref=${ref}"\n}`;
    }

    let files: Record<string, string>;

    function mockFiles(newFiles: Record<string, string>): void {
      files = newFiles;
      fs.readLocalDirectory.mockImplementation((dir: string) =>
        Promise.resolve(
          Object.keys(files)
            .filter((f) => upath.dirname(f) === upath.normalize(dir))
            .map((f) => upath.basename(f)),
        ),
      );
      fs.readLocalFile.mockImplementation((name: string) =>
        Promise.resolve(files[name] ?? null),
      );
    }

    function extractFile(name: string) {
      return extractPackageFile(files[name], name, {});
    }

    it('reports a variable of another file against the declaring file', async () => {
      mockFiles({
        'variables.tf': codeBlock`
          variable "tag" {
            type    = string
            const   = true
            default = "v1.0.0"
          }
        `,
        'main.tf': ghRef('hashicorp/example', '${var.tag}'),
      });

      const declaration = await extractFile('variables.tf');
      expect(declaration?.deps).toEqual([
        {
          depName: 'github.com/hashicorp/example',
          packageName: 'hashicorp/example',
          depType: 'module',
          currentValue: 'v1.0.0',
          datasource: 'github-tags',
        },
      ]);

      const usage = await extractFile('main.tf');
      expect(usage?.deps).toMatchObject([
        {
          depName: 'github.com/hashicorp/example',
          skipReason: 'contains-variable',
        },
      ]);
    });

    it('reports a local of another file against the declaring file', async () => {
      mockFiles({
        'locals.tf': codeBlock`
          locals {
            tag = "v1.0.0"
          }
        `,
        'main.tf': ghRef('hashicorp/example', '${local.tag}'),
      });

      const declaration = await extractFile('locals.tf');
      expect(declaration?.deps).toMatchObject([
        { depName: 'github.com/hashicorp/example', currentValue: 'v1.0.0' },
      ]);
    });

    it('resolves a version attribute of a registry module', async () => {
      mockFiles({
        'variables.tf': codeBlock`
          variable "ver" {
            const   = true
            default = "1.0.0"
          }
        `,
        'main.tf': codeBlock`
          module "consul" {
            source  = "hashicorp/consul/aws"
            version = var.ver
          }
        `,
      });

      const declaration = await extractFile('variables.tf');
      expect(declaration?.deps).toMatchObject([
        {
          depName: 'hashicorp/consul/aws',
          currentValue: '1.0.0',
          datasource: 'terraform-module',
        },
      ]);
    });

    it('supports .tofu files', async () => {
      mockFiles({
        'variables.tofu': codeBlock`
          variable "tag" {
            default = "v1.0.0"
          }
        `,
        'main.tofu': ghRef('hashicorp/example', '${var.tag}'),
      });

      const declaration = await extractFile('variables.tofu');
      expect(declaration?.deps).toMatchObject([{ currentValue: 'v1.0.0' }]);
    });

    it('reports the modules of several files in file name order', async () => {
      mockFiles({
        'variables.tf': codeBlock`
          variable "tag" {
            default = "v1.0.0"
          }
        `,
        'z.tf': ghRef('hashicorp/example', '${var.tag}'),
        'a.tf': `module "sub" {\n  source = "github.com/hashicorp/example//sub?ref=\${var.tag}"\n}`,
      });

      const declaration = await extractFile('variables.tf');
      expect(declaration?.deps).toHaveLength(2);
      expect(declaration?.deps.map((d) => d.skipReason)).toEqual([
        undefined,
        undefined,
      ]);
      expect(declaration?.deps.map((d) => d.depName)).toEqual([
        'github.com/hashicorp/example',
        'github.com/hashicorp/example',
      ]);
    });

    it('skips all modules of different repositories sharing a declaration', async () => {
      mockFiles({
        'variables.tf': codeBlock`
          variable "tag" {
            default = "v1.0.0"
          }
        `,
        'a.tf': ghRef('hashicorp/example', '${var.tag}'),
        'b.tf': ghRef('hashicorp/other', '${var.tag}'),
      });

      const declaration = await extractFile('variables.tf');
      expect(declaration?.deps).toMatchObject([
        { skipReason: 'contains-variable' },
        { skipReason: 'contains-variable' },
      ]);
    });

    it('skips a module of the declaring file and a sibling for different repositories', async () => {
      mockFiles({
        'main.tf': codeBlock`
          locals {
            tag = "v1.0.0"
          }

          ${ghRef('hashicorp/example', '${local.tag}')}
        `,
        'other.tf': ghRef('hashicorp/other', '${local.tag}'),
      });

      const declaration = await extractFile('main.tf');
      expect(declaration?.deps).toMatchObject([
        {
          depName: 'github.com/hashicorp/example',
          skipReason: 'contains-variable',
        },
        {
          depName: 'github.com/hashicorp/other',
          skipReason: 'contains-variable',
        },
      ]);
    });

    it('does not mix references of different declarations', async () => {
      mockFiles({
        'variables.tf': codeBlock`
          variable "a" {
            default = "v1.0.0"
          }

          variable "b" {
            default = "v2.0.0"
          }
        `,
        'main.tf': `${ghRef('hashicorp/example', '${var.a}')}\n\n${ghRef('hashicorp/other', '${var.b}')}`,
      });

      const declaration = await extractFile('variables.tf');
      expect(declaration?.deps).toMatchObject([
        { depName: 'github.com/hashicorp/example', currentValue: 'v1.0.0' },
        { depName: 'github.com/hashicorp/other', currentValue: 'v2.0.0' },
      ]);
      expect(declaration?.deps.some((d) => d.skipReason)).toBeFalse();
    });

    it('does not report modules which do not use a reference', async () => {
      mockFiles({
        'variables.tf': codeBlock`
          variable "tag" {
            default = "v1.0.0"
          }
        `,
        'main.tf': ghRef('hashicorp/example', 'v3.0.0'),
      });

      await expect(extractFile('variables.tf')).resolves.toBeNull();
    });

    it('does not report modules which use a reference declared nowhere', async () => {
      mockFiles({
        'variables.tf': codeBlock`
          variable "tag" {
            default = "v1.0.0"
          }
        `,
        'main.tf': ghRef('hashicorp/example', '${var.other}'),
      });

      await expect(extractFile('variables.tf')).resolves.toBeNull();
    });

    it('does not report a variable without default', async () => {
      mockFiles({
        'variables.tf': codeBlock`
          variable "tag" {
            const = true
          }
        `,
        'main.tf': ghRef('hashicorp/example', '${var.tag}'),
      });

      await expect(extractFile('variables.tf')).resolves.toBeNull();
    });

    it('does not report a chained local', async () => {
      mockFiles({
        'locals.tf': codeBlock`
          locals {
            base = "v1.0.0"
            tag  = local.base
          }
        `,
        'main.tf': ghRef('hashicorp/example', '${local.tag}'),
      });

      const declaration = await extractFile('locals.tf');
      expect(declaration?.deps).toBeUndefined();
    });

    it('does not report a local which is not a string', async () => {
      mockFiles({
        'locals.tf': codeBlock`
          locals {
            tag = 1
          }
        `,
        'main.tf': ghRef('hashicorp/example', '${local.tag}'),
      });

      await expect(extractFile('locals.tf')).resolves.toBeNull();
    });

    it('does not treat a local and a variable of the same name as equal', async () => {
      mockFiles({
        'locals.tf': codeBlock`
          locals {
            tag = "v1.0.0"
          }
        `,
        'main.tf': ghRef('hashicorp/example', '${var.tag}'),
      });

      await expect(extractFile('locals.tf')).resolves.toBeNull();
    });

    it('lets a sibling which declares the name itself resolve it on its own', async () => {
      mockFiles({
        'variables.tf': codeBlock`
          variable "tag" {
            default = "v1.0.0"
          }
        `,
        'main.tf': codeBlock`
          variable "tag" {
            default = "v2.0.0"
          }

          ${ghRef('hashicorp/example', '${var.tag}')}
        `,
      });

      await expect(extractFile('variables.tf')).resolves.toBeNull();
      const own = await extractFile('main.tf');
      expect(own?.deps).toMatchObject([{ currentValue: 'v2.0.0' }]);
    });

    it('lets a sibling which declares a local of the name itself resolve it on its own', async () => {
      mockFiles({
        'locals.tf': codeBlock`
          locals {
            tag = "v1.0.0"
          }
        `,
        'main.tf': codeBlock`
          locals {
            tag = "v2.0.0"
          }

          ${ghRef('hashicorp/example', '${local.tag}')}
        `,
      });

      await expect(extractFile('locals.tf')).resolves.toBeNull();
    });

    it('only considers files of the same directory', async () => {
      mockFiles({
        'infra/variables.tf': codeBlock`
          variable "tag" {
            default = "v1.0.0"
          }
        `,
        'infra/main.tf': ghRef('hashicorp/example', '${var.tag}'),
        'other/main.tf': ghRef('hashicorp/other', '${var.tag}'),
        'main.tf': ghRef('hashicorp/root', '${var.tag}'),
      });

      const declaration = await extractFile('infra/variables.tf');
      expect(declaration?.deps).toMatchObject([
        { depName: 'github.com/hashicorp/example' },
      ]);
      expect(fs.readLocalDirectory).toHaveBeenCalledWith('infra');
    });

    it('ignores files which are not terraform files', async () => {
      mockFiles({
        'variables.tf': codeBlock`
          variable "tag" {
            default = "v1.0.0"
          }
        `,
        'README.md': ghRef('hashicorp/example', '${var.tag}'),
        'main.tf.json': ghRef('hashicorp/example', '${var.tag}'),
      });

      await expect(extractFile('variables.tf')).resolves.toBeNull();
    });

    it('ignores siblings which cannot be used', async () => {
      mockFiles({
        'variables.tf': codeBlock`
          variable "tag" {
            default = "v1.0.0"
          }
        `,
        'broken.tf': 'module "a" { source = ${var.tag',
        'noref.tf': 'module "a" {\n  source = "hashicorp/consul/aws"\n}',
        'nomodule.tf': 'resource "a" "b" {\n  name = var.tag\n}',
        'empty.tf': '',
      });
      files['gone.tf'] = 'module "a" {}';
      fs.readLocalDirectory.mockResolvedValue([
        'broken.tf',
        'noref.tf',
        'nomodule.tf',
        'empty.tf',
        'gone.tf',
        'variables.tf',
      ]);
      fs.readLocalFile.mockImplementation((name: string) =>
        Promise.resolve(name === 'gone.tf' ? null : (files[name] ?? null)),
      );

      await expect(extractFile('variables.tf')).resolves.toBeNull();
    });

    it('ignores siblings with a skipped or non-versioned module', async () => {
      mockFiles({
        'variables.tf': codeBlock`
          variable "tag" {
            default = "v1.0.0"
          }
        `,
        'main.tf': codeBlock`
          module "local" {
            source  = "./modules/local"
            version = var.tag
          }

          module "nosource" {
            version = var.tag
          }
        `,
      });

      await expect(extractFile('variables.tf')).resolves.toBeNull();
    });

    it('does not resolve a reference of an OCI module', async () => {
      mockFiles({
        'variables.tf': codeBlock`
          variable "tag" {
            default = "1.0.0"
          }
        `,
        'main.tf': codeBlock`
          module "oci" {
            source = "oci://example.com/org/mod?tag=${'$'}{var.tag}"
          }
        `,
      });

      await expect(extractFile('variables.tf')).resolves.toBeNull();
    });

    it('does not fail when the directory cannot be read', async () => {
      mockFiles({
        'variables.tf': codeBlock`
          variable "tag" {
            default = "v1.0.0"
          }
        `,
      });
      fs.readLocalDirectory.mockRejectedValue(new Error('ENOENT'));

      await expect(extractFile('variables.tf')).resolves.toBeNull();
    });

    it('does not read the directory for files without declarations', async () => {
      mockFiles({
        'main.tf': ghRef('hashicorp/example', 'v1.0.0'),
      });

      const res = await extractFile('main.tf');
      expect(res?.deps).toMatchObject([{ currentValue: 'v1.0.0' }]);
      expect(fs.readLocalDirectory).not.toHaveBeenCalled();
    });

    describe('updates', () => {
      async function update(
        file: string,
        index: number,
        newValue: string,
        content = files[file],
        firstUpdate = true,
      ): Promise<string | null> {
        const extracted = await extractPackageFile(content, file, {});
        return doAutoReplace(
          partial<BranchUpgradeConfig>({
            ...extracted!.deps[index],
            manager: 'terraform',
            packageFile: file,
            depIndex: index,
            newValue,
          }),
          content,
          false,
          firstUpdate,
        );
      }

      it('updates the declaring file and not the module file', async () => {
        mockFiles({
          'variables.tf': codeBlock`
            variable "tag" {
              const   = true
              default = "v1.0.0"
            }
          `,
          'main.tf': ghRef('hashicorp/example', '${var.tag}'),
        });

        await expect(update('variables.tf', 0, 'v2.0.0')).resolves.toBe(
          codeBlock`
            variable "tag" {
              const   = true
              default = "v2.0.0"
            }
          `,
        );
      });

      it('updates a local of another file', async () => {
        mockFiles({
          'locals.tf': codeBlock`
            locals {
              tag = "v1.0.0"
            }
          `,
          'main.tf': ghRef('hashicorp/example', '${local.tag}'),
        });

        await expect(update('locals.tf', 0, 'v2.0.0')).resolves.toBe(
          codeBlock`
            locals {
              tag = "v2.0.0"
            }
          `,
        );
      });

      it('updates the declaration which shares its value with another text', async () => {
        mockFiles({
          'variables.tf': codeBlock`
            variable "other" {
              description = "pinned to v1.0.0 for legacy reasons"
              default     = "v0.1.0"
            }

            variable "tag" {
              default = "v1.0.0"
            }
          `,
          'main.tf': ghRef('hashicorp/example', '${var.tag}'),
        });

        await expect(update('variables.tf', 0, 'v2.0.0')).resolves.toBe(
          codeBlock`
            variable "other" {
              description = "pinned to v1.0.0 for legacy reasons"
              default     = "v0.1.0"
            }

            variable "tag" {
              default = "v2.0.0"
            }
          `,
        );
      });

      it('updates once when several modules of other files share a declaration', async () => {
        mockFiles({
          'variables.tf': codeBlock`
            variable "tag" {
              default = "v1.0.0"
            }
          `,
          'a.tf': ghRef('hashicorp/example', '${var.tag}'),
          'b.tf': `module "sub" {\n  source = "github.com/hashicorp/example//sub?ref=\${var.tag}"\n}`,
        });

        const first = await update('variables.tf', 0, 'v2.0.0');
        expect(first).toContain('default = "v2.0.0"');
        await expect(
          update('variables.tf', 1, 'v2.0.0', first!, false),
        ).resolves.toBe(first);
      });
    });
  });

  describe('extract git-tags modules with .git in domain or repo name', () => {
    describe('SSH URL with .git in domain and standard path', () => {
      const source =
        'git::ssh://git@test.git.example.git.com/modules/foo-module.git//bar?ref=v1.0.0';

      it('should extract the correct depName', () => {
        const res = extractor.extract(
          { module: { foo: [{ source }] } },
          [],
          {},
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          depName: 'test.git.example.git.com/modules/foo-module',
          currentValue: 'v1.0.0',
          datasource: 'git-tags',
        });
      });

      it('should extract the correct packageName', () => {
        const res = extractor.extract(
          { module: { foo: [{ source }] } },
          [],
          {},
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          packageName: 'ssh://git@test.git.example.git.com/modules/foo-module',
        });
      });
    });

    describe('SSH URL with .git in domain and colon-separated path', () => {
      const source =
        'git::ssh://git@test.git.example.git.com:modules/foo-module.git//bar?ref=v2.0.0';

      it('should extract the correct depName', () => {
        const res = extractor.extract(
          { module: { foo: [{ source }] } },
          [],
          {},
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          depName: 'test.git.example.git.com:modules/foo-module',
          currentValue: 'v2.0.0',
          datasource: 'git-tags',
        });
      });

      it('should extract the correct packageName', () => {
        const res = extractor.extract(
          { module: { foo: [{ source }] } },
          [],
          {},
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          packageName: 'ssh://git@test.git.example.git.com:modules/foo-module',
        });
      });
    });

    describe('HTTPS URL with .git in domain and no trailing .git', () => {
      const source =
        'git::https://git@test.git.example.git.com/modules/foo-module?ref=v3.0.0';

      it('should extract the correct depName', () => {
        const res = extractor.extract(
          { module: { foo: [{ source }] } },
          [],
          {},
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          depName: 'test.git.example.git.com/modules/foo-module',
          currentValue: 'v3.0.0',
          datasource: 'git-tags',
        });
      });

      it('should extract the correct packageName', () => {
        const res = extractor.extract(
          { module: { foo: [{ source }] } },
          [],
          {},
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          packageName:
            'https://git@test.git.example.git.com/modules/foo-module',
        });
      });
    });

    describe('HTTPS URL with .git in repo name', () => {
      const source =
        'git::https://git@test.example.com/modules.git-repo/foo-module?ref=v3.0.0';

      it('should extract the correct depName', () => {
        const res = extractor.extract(
          { module: { foo: [{ source }] } },
          [],
          {},
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          depName: 'test.example.com/modules.git-repo/foo-module',
          currentValue: 'v3.0.0',
          datasource: 'git-tags',
        });
      });

      it('should extract the correct packageName', () => {
        const res = extractor.extract(
          { module: { foo: [{ source }] } },
          [],
          {},
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          packageName:
            'https://git@test.example.com/modules.git-repo/foo-module',
        });
      });
    });
  });
});
