import {
  ModuleExtractor,
  azureDevOpsSshRefMatchRegex,
  bitbucketRefMatchRegex,
  gitTagsRefMatchRegex,
  githubRefMatchRegex,
} from './modules';

describe('modules/manager/terraform/extractors/others/modules', () => {
  const extractor = new ModuleExtractor();

  it('return empty array if no module is found', () => {
    const res = extractor.extract({});
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
        project: '/bar',
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
        project: 'terraform/instance.git',
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
});
