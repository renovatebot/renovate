import fs from 'fs-extra';
import upath from 'upath';
import { getName } from '../../../test/util';
import { extractPackageFile } from '.';

const sample = fs.readFileSync(
  upath.resolve(__dirname, './__fixtures__/mix.exs'),
  'utf-8'
);

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
