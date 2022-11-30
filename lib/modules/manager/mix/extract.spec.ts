import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import { extractPackageFile } from '.';

describe('modules/manager/mix/extract', () => {
  beforeEach(() => {
    GlobalConfig.set({ localDir: '' });
  });

  describe('extractPackageFile()', () => {
    it('returns empty for invalid dependency file', async () => {
      const res = await extractPackageFile('nothing here', 'mix.exs');
      expect(res?.deps).toBeEmpty();
    });

    it('extracts all dependencies', async () => {
      const res = await extractPackageFile(Fixtures.get('mix.exs'), 'mix.exs');
      expect(res).toMatchSnapshot();
    });
  });
});
