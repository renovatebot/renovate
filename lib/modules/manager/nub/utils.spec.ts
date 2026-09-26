import { fileMatchesWorkspaces, filesMatchingWorkspaces } from './utils.ts';

describe('modules/manager/nub/utils', () => {
  const pwd = '/project';

  describe('fileMatchesWorkspaces', () => {
    it('should return false when fileName does not start with pwd', () => {
      const fileName = '/another-path/package.json';
      const workspaces = ['**'];
      expect(fileMatchesWorkspaces(pwd, fileName, workspaces)).toBe(false);
    });

    it('should correctly evaluate fileName when it starts with pwd', () => {
      const fileName = '/project/foo/package.json';
      const workspaces = ['foo'];
      expect(fileMatchesWorkspaces(pwd, fileName, workspaces)).toBe(true);
    });
  });

  describe('filesMatchingWorkspaces', () => {
    const workspaces = ['foo', 'bar'];
    const files = [
      '/project/foo/package.json',
      '/project/bar/package.json',
      '/other/baz/package.json', // filtered out — does not start with pwd
    ];

    it('should filter files matching workspaces and pwd', () => {
      const result = filesMatchingWorkspaces(pwd, files, workspaces);
      expect(result).toEqual([
        '/project/foo/package.json',
        '/project/bar/package.json',
      ]);
    });
  });
});
