const fs = require('fs');
const { extractPackageFile } = require('../../../lib/manager/composer/extract');

/** @type any */
const platform = global.platform;

const requirements1 = fs.readFileSync(
  'test/manager/composer/_fixtures/composer1.json',
  'utf8'
);
const requirements2 = fs.readFileSync(
  'test/manager/composer/_fixtures/composer2.json',
  'utf8'
);
const requirements3 = fs.readFileSync(
  'test/manager/composer/_fixtures/composer3.json',
  'utf8'
);
const requirements4 = fs.readFileSync(
  'test/manager/composer/_fixtures/composer4.json',
  'utf8'
);
const requirements5 = fs.readFileSync(
  'test/manager/composer/_fixtures/composer5.json',
  'utf8'
);
const requirements5Lock = fs.readFileSync(
  'test/manager/composer/_fixtures/composer5.lock',
  'utf8'
);

describe('lib/manager/composer/extract', () => {
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
    });
    it('extracts registryUrls', async () => {
      const res = await extractPackageFile(requirements2, packageFile);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toHaveLength(1);
    });
    it('extracts object registryUrls', async () => {
      const res = await extractPackageFile(requirements3, packageFile);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toHaveLength(3);
    });
    it('extracts repositories and registryUrls', async () => {
      const res = await extractPackageFile(requirements4, packageFile);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toHaveLength(1);
    });
    it('extracts object repositories and registryUrls with lock file', async () => {
      platform.getFile.mockReturnValueOnce(requirements5Lock);
      const res = await extractPackageFile(requirements5, packageFile);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toHaveLength(1);
    });
    it('extracts dependencies with lock file', async () => {
      platform.getFile.mockReturnValueOnce('some content');
      const res = await extractPackageFile(requirements1, packageFile);
      expect(res).toMatchSnapshot();
    });
  });
});
