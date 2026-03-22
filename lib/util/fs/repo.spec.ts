import { scm } from '~test/util.ts';
import { getMatchingFiles } from './repo.ts';

describe('util/fs/repo', () => {
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
