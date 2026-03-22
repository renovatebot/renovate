import { scm } from '~test/util.ts';
import { getMatchingFiles, resolveRelativePathToRoot } from './tree.ts';

describe('util/tree', () => {
  describe('resolveRelativePathToRoot', () => {
    it('resolves relative path from a subdirectory file', () => {
      const result = resolveRelativePathToRoot(
        'two/two.csproj',
        '../one/one.csproj',
      );
      expect(result).toBe('one/one.csproj');
    });

    it('resolves same-directory reference', () => {
      const result = resolveRelativePathToRoot(
        'moduleA/go.mod',
        './local/go.mod',
      );
      expect(result).toBe('moduleA/local/go.mod');
    });

    it('resolves parent directory reference', () => {
      const result = resolveRelativePathToRoot(
        'services/api/go.mod',
        '../../libs/shared',
      );
      expect(result).toBe('libs/shared');
    });

    it('resolves from root-level file', () => {
      const result = resolveRelativePathToRoot('go.mod', './sub');
      expect(result).toBe('sub');
    });

    it('resolves deeply nested paths', () => {
      const result = resolveRelativePathToRoot(
        'a/b/c/file.txt',
        '../../../other/file.txt',
      );
      expect(result).toBe('other/file.txt');
    });
  });

  describe('getMatchingFiles', () => {
    it('filters files using minimatch pattern', async () => {
      scm.getFileList.mockResolvedValue([
        'one/one.csproj',
        'two/two.vbproj',
        'three/three.fsproj',
        'readme.md',
        'go.mod',
      ]);

      const result = await getMatchingFiles('*.{cs,vb,fs}proj');
      expect(result).toEqual([
        'one/one.csproj',
        'two/two.vbproj',
        'three/three.fsproj',
      ]);
    });

    it('filters go.mod files', async () => {
      scm.getFileList.mockResolvedValue([
        'go.mod',
        'api/go.mod',
        'cmd/go.mod',
        'readme.md',
        'go.sum',
      ]);

      const result = await getMatchingFiles('go.mod');
      expect(result).toEqual(['go.mod', 'api/go.mod', 'cmd/go.mod']);
    });

    it('returns empty array when no files match', async () => {
      scm.getFileList.mockResolvedValue(['readme.md', 'package.json']);

      const result = await getMatchingFiles('go.mod');
      expect(result).toEqual([]);
    });
  });
});
