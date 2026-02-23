import { getPkgReleases } from '../index.ts';
import { NoopDatasource } from './index.ts';

describe('modules/datasource/noop/index', () => {
  describe('getReleases', () => {
    it('returns the current value as the only release', async () => {
      const res = await getPkgReleases({
        datasource: NoopDatasource.id,
        packageName: 'some-package',
        currentValue: '1.2.3',
      });

      expect(res).toEqual({ releases: [{ version: '1.2.3' }] });
    });

    it('returns null when no current value', async () => {
      const res = await getPkgReleases({
        datasource: NoopDatasource.id,
        packageName: 'some-package',
      });

      expect(res).toBeNull();
    });
  });
});
