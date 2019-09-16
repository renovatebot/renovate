import { readFileSync } from 'fs';
import { extractPackageFile } from '../../../lib/manager/composer/extract';
import { platform as _platform, Platform } from '../../../lib/platform';

const platform: jest.Mocked<Platform> = _platform as any;

const requirements1 = readFileSync(
  'test/manager/composer/_fixtures/composer1.json',
  'utf8'
);
const requirements2 = readFileSync(
  'test/manager/composer/_fixtures/composer2.json',
  'utf8'
);
const requirements3 = readFileSync(
  'test/manager/composer/_fixtures/composer3.json',
  'utf8'
);
const requirements4 = readFileSync(
  'test/manager/composer/_fixtures/composer4.json',
  'utf8'
);
const requirements5 = readFileSync(
  'test/manager/composer/_fixtures/composer5.json',
  'utf8'
);
const requirements5Lock = readFileSync(
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
      expect(res.registryUrls).toHaveLength(1);
    });
    it('extracts repositories and registryUrls', async () => {
      const res = await extractPackageFile(requirements4, packageFile);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toHaveLength(2);
    });
    it('extracts object repositories and registryUrls with lock file', async () => {
      platform.getFile.mockResolvedValue(requirements5Lock);
      const res = await extractPackageFile(requirements5, packageFile);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toHaveLength(2);
    });
    it('extracts dependencies with lock file', async () => {
      platform.getFile.mockResolvedValue('some content');
      const res = await extractPackageFile(requirements1, packageFile);
      expect(res).toMatchSnapshot();
    });
  });
});
