import { extractAllPackageFiles } from '.';

describe('modules/manager/bun/extract/index', () => {
  describe('extractAllPackageFiles()', () => {
    it('ignores non-bun files', async () => {
      expect(await extractAllPackageFiles({}, ['package.json'])).toEqual([]);
    });
  });
});
