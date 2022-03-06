import { fs, loadFixture } from '../../../../test/util';
import { extractPackageFile } from './extract';

jest.mock('../../../util/fs');

const requirements1 = loadFixture('composer1.json');
const requirements2 = loadFixture('composer2.json');
const requirements3 = loadFixture('composer3.json');
const requirements4 = loadFixture('composer4.json');
const requirements5 = loadFixture('composer5.json');
const requirements5Lock = loadFixture('composer5.lock');

describe('modules/manager/composer/extract', () => {
  describe('extractPackageFile()', () => {
    let packageFile;
    beforeEach(() => {
      packageFile = 'composer.json';
    });
    it('returns null for invalid json', async () => {
      expect(await extractPackageFile('nothing here', packageFile)).toBeNull();
    });
    it('returns null for empty deps', async () => {
      expect(await extractPackageFile('{}', packageFile)).toBeNull();
    });
    it('extracts dependencies with no lock file', async () => {
      const res = await extractPackageFile(requirements1, packageFile);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(32);
    });
    it('extracts registryUrls', async () => {
      const res = await extractPackageFile(requirements2, packageFile);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toHaveLength(1);
    });
    it('extracts object registryUrls', async () => {
      const res = await extractPackageFile(requirements3, packageFile);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toHaveLength(1);
    });
    it('extracts repositories and registryUrls', async () => {
      const res = await extractPackageFile(requirements4, packageFile);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toHaveLength(3);
    });
    it('extracts object repositories and registryUrls with lock file', async () => {
      fs.readLocalFile.mockResolvedValue(requirements5Lock);
      const res = await extractPackageFile(requirements5, packageFile);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toHaveLength(2);
    });
    it('extracts dependencies with lock file', async () => {
      fs.readLocalFile.mockResolvedValue('some content');
      const res = await extractPackageFile(requirements1, packageFile);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(32);
    });
  });
});
