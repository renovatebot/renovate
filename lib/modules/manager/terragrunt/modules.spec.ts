import type { PackageDependency } from '../types.ts';
import { analyseTerragruntModule, gitTagsRefMatchRegex } from './modules.ts';
import type { TerraformManagerData } from './types.ts';

describe('modules/manager/terragrunt/modules', () => {
  describe('gitTagsRefMatchRegex', () => {
    it('should split host, path and tag from source', () => {
      const http = gitTagsRefMatchRegex.exec(
        'http://github.com/hashicorp/example?ref=v1.0.0',
      )?.groups;
      const https = gitTagsRefMatchRegex.exec(
        'https://github.com/hashicorp/example?ref=v1.0.0',
      )?.groups;
      const ssh = gitTagsRefMatchRegex.exec(
        'ssh://github.com/hashicorp/example?ref=v1.0.0',
      )?.groups;

      expect(http).toMatchObject({
        host: 'github.com',
        path: 'hashicorp/example',
        tag: 'v1.0.0',
      });
      expect(https).toMatchObject({
        host: 'github.com',
        path: 'hashicorp/example',
        tag: 'v1.0.0',
      });
      expect(ssh).toMatchObject({
        host: 'github.com',
        path: 'hashicorp/example',
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

      expect(http).toMatchObject({
        path: 'hashicorp/example.repo-123',
        tag: 'v1.0.0',
      });
      expect(https).toMatchObject({
        path: 'hashicorp/example.repo-123',
        tag: 'v1.0.0',
      });
      expect(ssh).toMatchObject({
        path: 'hashicorp/example.repo-123',
        tag: 'v1.0.0',
      });
    });
  });
});

describe('modules/manager/terragrunt/modules', () => {
  function analyse(
    source?: string,
  ): PackageDependency<TerraformManagerData> | PackageDependency {
    const dep: PackageDependency<TerraformManagerData> = {
      managerData: {
        source,
        moduleName: 'terragrunt',
      },
    };
    analyseTerragruntModule(dep);
    delete dep.managerData;
    return dep;
  }

  it('sets skipReason for invalid git tags URL', () => {
    expect(analyse('ssh://[/path?ref=v1.0.0')).toMatchObject({
      skipReason: 'invalid-url',
    });
  });

  it('sets skipReason for missing source', () => {
    expect(analyse()).toMatchObject({ skipReason: 'no-source' });
  });

  it('sets skipReason for a relative local path', () => {
    expect(analyse('./modules/foo')).toMatchObject({ skipReason: 'local' });
    expect(analyse('../modules/foo')).toMatchObject({ skipReason: 'local' });
  });

  it('extracts Azure DevOps SSH sources', () => {
    expect(
      analyse(
        'git::git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository//some-module/path?ref=v1.0.0',
      ),
    ).toEqual({
      currentValue: 'v1.0.0',
      datasource: 'git-tags',
      depName: 'MyOrg/MyProject/MyRepository//some-module/path',
      depType: 'gitTags',
      packageName: 'git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository',
    });
  });
});
