import fs from 'fs-extra';
import upath from 'upath';
import { extractPackageFile } from '.';

const sample = fs.readFileSync(
  upath.resolve(__dirname, './__fixtures__/mix.exs'),
  'utf-8'
);

describe('lib/manager/mix/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns empty for invalid dependency file', () => {
      expect(extractPackageFile('nothing here')).toMatchSnapshot();
    });
    it('extracts all dependencies', () => {
      const res = extractPackageFile(sample).deps;
      expect(res).toMatchSnapshot();
    });
  });
});
