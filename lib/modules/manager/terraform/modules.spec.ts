import {
  bitbucketRefMatchRegex,
  gitTagsRefMatchRegex,
  githubRefMatchRegex,
} from './modules';

describe('modules/manager/terraform/modules', () => {
  describe('githubRefMatchRegex', () => {
    it('should split project and tag from source', () => {
      const { project, tag } = githubRefMatchRegex.exec(
        'github.com/hashicorp/example?ref=v1.0.0'
      ).groups;
      expect(project).toBe('hashicorp/example');
      expect(tag).toBe('v1.0.0');
    });

    it('should parse alpha-numeric characters as well as dots, underscores, and dashes in repo names', () => {
      const { project } = githubRefMatchRegex.exec(
        'github.com/hashicorp/example.repo-123?ref=v1.0.0'
      ).groups;
      expect(project).toBe('hashicorp/example.repo-123');
    });
  });
  describe('gitTagsRefMatchRegex', () => {
    it('should split project and tag from source', () => {
      const http = gitTagsRefMatchRegex.exec(
        'http://github.com/hashicorp/example?ref=v1.0.0'
      ).groups;
      const https = gitTagsRefMatchRegex.exec(
        'https://github.com/hashicorp/example?ref=v1.0.0'
      ).groups;
      const ssh = gitTagsRefMatchRegex.exec(
        'ssh://github.com/hashicorp/example?ref=v1.0.0'
      ).groups;

      expect(http.project).toBe('hashicorp/example');
      expect(http.tag).toBe('v1.0.0');

      expect(https.project).toBe('hashicorp/example');
      expect(https.tag).toBe('v1.0.0');

      expect(ssh.project).toBe('hashicorp/example');
      expect(ssh.tag).toBe('v1.0.0');
    });

    it('should parse alpha-numeric characters as well as dots, underscores, and dashes in repo names', () => {
      const http = gitTagsRefMatchRegex.exec(
        'http://github.com/hashicorp/example.repo-123?ref=v1.0.0'
      ).groups;
      const https = gitTagsRefMatchRegex.exec(
        'https://github.com/hashicorp/example.repo-123?ref=v1.0.0'
      ).groups;
      const ssh = gitTagsRefMatchRegex.exec(
        'ssh://github.com/hashicorp/example.repo-123?ref=v1.0.0'
      ).groups;

      expect(http.project).toBe('hashicorp/example.repo-123');
      expect(http.tag).toBe('v1.0.0');

      expect(https.project).toBe('hashicorp/example.repo-123');
      expect(https.tag).toBe('v1.0.0');

      expect(ssh.project).toBe('hashicorp/example.repo-123');
      expect(ssh.tag).toBe('v1.0.0');
    });
  });
  describe('bitbucketRefMatchRegex', () => {
    it('should split workspace, project and tag from source', () => {
      const ssh = bitbucketRefMatchRegex.exec(
        'git::ssh://git@bitbucket.org/hashicorp/example.git?ref=v1.0.0'
      ).groups;
      const https = bitbucketRefMatchRegex.exec(
        'git::https://git@bitbucket.org/hashicorp/example.git?ref=v1.0.0'
      ).groups;
      const plain = bitbucketRefMatchRegex.exec(
        'bitbucket.org/hashicorp/example.git?ref=v1.0.0'
      ).groups;
      const subfolder = bitbucketRefMatchRegex.exec(
        'bitbucket.org/hashicorp/example.git/terraform?ref=v1.0.0'
      ).groups;
      const subfolderWithDoubleSlash = bitbucketRefMatchRegex.exec(
        'bitbucket.org/hashicorp/example.git//terraform?ref=v1.0.0'
      ).groups;

      expect(ssh.workspace).toBe('hashicorp');
      expect(ssh.project).toBe('example');
      expect(ssh.tag).toBe('v1.0.0');

      expect(https.workspace).toBe('hashicorp');
      expect(https.project).toBe('example');
      expect(https.tag).toBe('v1.0.0');

      expect(plain.workspace).toBe('hashicorp');
      expect(plain.project).toBe('example');
      expect(plain.tag).toBe('v1.0.0');

      expect(subfolder.workspace).toBe('hashicorp');
      expect(subfolder.project).toBe('example');
      expect(subfolder.tag).toBe('v1.0.0');

      expect(subfolderWithDoubleSlash.workspace).toBe('hashicorp');
      expect(subfolderWithDoubleSlash.project).toBe('example');
      expect(subfolderWithDoubleSlash.tag).toBe('v1.0.0');
    });

    it('should parse alpha-numeric characters as well as dots, underscores, and dashes in repo names', () => {
      const dots = bitbucketRefMatchRegex.exec(
        'bitbucket.org/hashicorp/example.repo-123.git?ref=v1.0.0'
      ).groups;

      expect(dots.workspace).toBe('hashicorp');
      expect(dots.project).toBe('example.repo-123');
      expect(dots.tag).toBe('v1.0.0');
    });
  });
});
