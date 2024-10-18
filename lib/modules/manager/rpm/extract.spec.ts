import { extractPackageFile } from '.';

describe('modules/manager/rpm/extract', () => {
  describe('extractPackageFile()', () => {
    it('always returns empty yaml', async () => {
      expect(await extractPackageFile('', 'rpms.in.yaml')).toEqual({
        deps: [],
        lockFiles: ['rpms.lock.yaml'],
      })
    });

    it('always returns empty yml', async () => {
      expect(await extractPackageFile('', 'rpms.in.yml')).toEqual({
        deps: [],
        lockFiles: ['rpms.lock.yml'],
      })
    });
  });
});
