import { readFileSync } from 'fs';
import { fs, hostRules } from '../../../test/util';
import { extractPackageFile } from './extract';

jest.mock('fs-extra');
jest.mock('../../util/fs');
jest.mock('../../util/host-rules');

const requirements1 = readFileSync(
  'lib/manager/composer/__fixtures__/composer1.json',
  'utf8'
);
const requirements2 = readFileSync(
  'lib/manager/composer/__fixtures__/composer2.json',
  'utf8'
);
const requirements3 = readFileSync(
  'lib/manager/composer/__fixtures__/composer3.json',
  'utf8'
);
const requirements4 = readFileSync(
  'lib/manager/composer/__fixtures__/composer4.json',
  'utf8'
);
const requirements5 = readFileSync(
  'lib/manager/composer/__fixtures__/composer5.json',
  'utf8'
);
const requirements5Lock = readFileSync(
  'lib/manager/composer/__fixtures__/composer5.lock',
  'utf8'
);
const auth1Json = readFileSync(
  'lib/manager/composer/__fixtures__/auth1.json',
  'utf8'
);
const auth2Json = readFileSync(
  'lib/manager/composer/__fixtures__/auth2.json',
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
      fs.readLocalFile.mockResolvedValue(requirements5Lock);
      const res = await extractPackageFile(requirements5, packageFile);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toHaveLength(2);
    });
    it('extracts dependencies with lock file', async () => {
      fs.readLocalFile.mockResolvedValue('some content');
      const res = await extractPackageFile(requirements1, packageFile);
      expect(res).toMatchSnapshot();
    });
  });
  describe('extractHostRulesFromAuthFile()', () => {
    let packageFile;
    beforeEach(() => {
      jest.resetAllMocks();
      packageFile = 'composer.json';
    });
    it('adds hostRules for everything in auth.json', async () => {
      fs.pathExists.mockReturnValueOnce(true as any);
      fs.readJson.mockReturnValueOnce(JSON.parse(auth1Json));
      await extractPackageFile('{}', packageFile);

      expect(hostRules.add).toHaveBeenCalledTimes(3);
      expect(hostRules.add).toMatchSnapshot();
    });
    it('adds hostRules for gitlab-oauth in auth.json', async () => {
      fs.pathExists.mockReturnValueOnce(true as any);
      fs.readJson.mockReturnValueOnce(JSON.parse(auth2Json));
      await extractPackageFile('{}', packageFile);

      expect(hostRules.add).toHaveBeenCalledTimes(1);
      expect(hostRules.add).toMatchSnapshot();
    });
  });
});
