const fileMatch = require('../../../../lib/workers/repository/extract/file-match');

describe('workers/repository/extract/file-match', () => {
  const fileList = ['package.json', 'frontend/package.json'];
  describe('getIncludedFiles()', () => {
    it('returns fileList if no includePaths', () => {
      const res = fileMatch.getIncludedFiles(fileList, []);
      expect(res).toEqual(fileList);
    });
    it('returns exact matches', () => {
      const includePaths = ['frontend/package.json'];
      const res = fileMatch.getIncludedFiles(fileList, includePaths);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
    it('returns minimatch matches', () => {
      const includePaths = ['frontend/**'];
      const res = fileMatch.getIncludedFiles(fileList, includePaths);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
  });
  describe('filterIgnoredFiles()', () => {
    it('returns fileList if no ignoredPaths', () => {
      const res = fileMatch.filterIgnoredFiles(fileList, []);
      expect(res).toEqual(fileList);
    });
    it('ignores partial matches', () => {
      const ignoredPaths = ['frontend'];
      const res = fileMatch.filterIgnoredFiles(fileList, ignoredPaths);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
    it('returns minimatch matches', () => {
      const ignoredPaths = ['frontend/**'];
      const res = fileMatch.filterIgnoredFiles(fileList, ignoredPaths);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
  });
  describe('getMatchingFiles()', () => {
    it('returns npm files', () => {
      fileList.push('Dockerfile');
      const res = fileMatch.getMatchingFiles(fileList, 'npm', [
        '(^|/)package.json$',
      ]);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });
    it('deduplicates', () => {
      fileList.push('Dockerfile');
      const res = fileMatch.getMatchingFiles(fileList, 'npm', [
        '(^|/)package.json$',
        'package.json',
      ]);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });
  });
});
