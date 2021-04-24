import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from '.';

const sample = loadFixture(__filename, 'mix.exs');

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns empty for invalid dependency file', async () => {
      expect(
        await extractPackageFile('nothing here', 'mix.exs')
      ).toMatchSnapshot();
    });
    it('extracts all dependencies', async () => {
      const res = await extractPackageFile(sample, 'mix.exs');
      expect(res).toMatchSnapshot();
    });
  });
});
