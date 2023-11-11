import { gitTagsRefMatchRegex, githubRefMatchRegex } from './modules';

describe('modules/manager/terragrunt/modules', () => {
  describe('githubRefMatchRegex', () => {
    it('should split project and tag from source', () => {
      const groups = githubRefMatchRegex.exec(
        'github.com/hashicorp/example?ref=v1.0.0',
      )?.groups;
      expect(groups).toEqual({
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
    });
  });
});
