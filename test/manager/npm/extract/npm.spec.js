const fs = require('fs');
const { getNpmLock } = require('../../../../lib/manager/npm/extract/npm');

describe('manager/npm/extract/npm', () => {
  describe('.getNpmLock()', () => {
    it('returns empty if failed to parse', async () => {
      platform.getFile.mockReturnValueOnce('abcd');
      const res = await getNpmLock('package.json');
      expect(Object.keys(res)).toHaveLength(0);
    });
    it('extracts', async () => {
      const plocktest1Lock = fs.readFileSync(
        'test/_fixtures/npm/plocktest1/package-lock.json'
      );
      platform.getFile.mockReturnValueOnce(plocktest1Lock);
      const res = await getNpmLock('package.json');
      expect(res).toMatchSnapshot();
      expect(Object.keys(res)).toHaveLength(7);
    });
  });
});
