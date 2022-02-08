import { loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const setup_cfg = loadFixture('setup-cfg-1.txt');

describe('manager/setup-cfg/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts dependencies', () => {
      const res = extractPackageFile(setup_cfg);
      expect(res).toMatchSnapshot();
    });
  });
});
