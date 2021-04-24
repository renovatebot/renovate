import { getName } from '../../../test/util';
import { gitTagsRefMatchRegex, githubRefMatchRegex } from './modules';

describe(getName(__filename), () => {
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
});
