import { getName, loadFixture } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import { extractPackageFile } from '.';

const sample = loadFixture('mix.exs');

describe(getName(), () => {
  beforeEach(() => {
    setGlobalConfig({ localDir: '' });
  });

  describe('extractPackageFile()', () => {
    it('returns empty for invalid dependency file', async () => {
      // FIXME: explicit assert condition
      expect(
        await extractPackageFile('nothing here', 'mix.exs')
      ).toMatchSnapshot();
    });
    it('extracts all dependencies', async () => {
      // FIXME: explicit assert condition
      const res = await extractPackageFile(sample, 'mix.exs');
      expect(res).toMatchSnapshot();
    });
  });
});
