import { fs, getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

jest.mock('../../util/fs');

const pyproject1toml = loadFixture('pyproject.1.toml');
const pyproject2toml = loadFixture('pyproject.2.toml');
const pyproject3toml = loadFixture('pyproject.3.toml');
const pyproject4toml = loadFixture('pyproject.4.toml');
const pyproject5toml = loadFixture('pyproject.5.toml');
const pyproject6toml = loadFixture('pyproject.6.toml');
const pyproject7toml = loadFixture('pyproject.7.toml');
const pyproject8toml = loadFixture('pyproject.8.toml');
const pyproject9toml = loadFixture('pyproject.9.toml');

// pyproject.10.toml use by artifacts
const pyproject11toml = loadFixture('pyproject.11.toml');
const pyproject11tomlLock = loadFixture('pyproject.11.toml.lock');

describe(getName(), () => {
  describe('extractPackageFile()', () => {
    let filename: string;
    const OLD_ENV = process.env;
    beforeEach(() => {
      filename = '';
      process.env = { ...OLD_ENV };
      delete process.env.PIP_INDEX_URL;
    });
    afterEach(() => {
      process.env = OLD_ENV;
    });
    it('returns null for empty', async () => {
      expect(await extractPackageFile('nothing here', filename)).toBeNull();
    });
    it('returns null for parsed file without poetry section', async () => {
      expect(await extractPackageFile(pyproject5toml, filename)).toBeNull();
    });
    it('extracts multiple dependencies', async () => {
      const res = await extractPackageFile(pyproject1toml, filename);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(9);
      expect(res.constraints).toEqual({
        poetry: 'poetry>=1.0 wheel',
        python: '~2.7 || ^3.4',
      });
    });
    it('extracts multiple dependencies (with dep = {version = "1.2.3"} case)', async () => {
      const res = await extractPackageFile(pyproject2toml, filename);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(7);
    });
    it('handles case with no dependencies', async () => {
      const res = await extractPackageFile(pyproject3toml, filename);
      expect(res).toBeNull();
    });
    it('handles multiple constraint dependencies', async () => {
      const res = await extractPackageFile(pyproject4toml, filename);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });
    it('extracts registries', async () => {
      const res = await extractPackageFile(pyproject6toml, filename);
      expect(res.registryUrls).toMatchSnapshot();
      expect(res.registryUrls).toHaveLength(3);
    });
    it('can parse empty registries', async () => {
      const res = await extractPackageFile(pyproject7toml, filename);
      expect(res.registryUrls).toBeNull();
    });
    it('can parse missing registries', async () => {
      const res = await extractPackageFile(pyproject1toml, filename);
      expect(res.registryUrls).toBeNull();
    });
    it('dedupes registries', async () => {
      const res = await extractPackageFile(pyproject8toml, filename);
      expect(res.registryUrls).toMatchSnapshot();
    });
    it('extracts mixed versioning types', async () => {
      const res = await extractPackageFile(pyproject9toml, filename);
      expect(res).toMatchSnapshot();
    });
    it('resolves lockedVersions from the lockfile', async () => {
      fs.readLocalFile.mockResolvedValue(pyproject11tomlLock);
      const res = await extractPackageFile(pyproject11toml, filename);
      expect(res).toMatchSnapshot();
    });
    it('skips git dependencies', async () => {
      const content =
        '[tool.poetry.dependencies]\r\nflask = {git = "https://github.com/pallets/flask.git"}\r\nwerkzeug = ">=0.14"';
      const res = (await extractPackageFile(content, filename)).deps;
      expect(res[0].depName).toBe('flask');
      expect(res[0].currentValue).toBe('');
      expect(res[0].skipReason).toBe('git-dependency');
      expect(res).toHaveLength(2);
    });
    it('skips git dependencies with version', async () => {
      const content =
        '[tool.poetry.dependencies]\r\nflask = {git = "https://github.com/pallets/flask.git", version="1.2.3"}\r\nwerkzeug = ">=0.14"';
      const res = (await extractPackageFile(content, filename)).deps;
      expect(res[0].depName).toBe('flask');
      expect(res[0].currentValue).toBe('1.2.3');
      expect(res[0].skipReason).toBe('git-dependency');
      expect(res).toHaveLength(2);
    });
    it('skips path dependencies', async () => {
      const content =
        '[tool.poetry.dependencies]\r\nflask = {path = "/some/path/"}\r\nwerkzeug = ">=0.14"';
      const res = (await extractPackageFile(content, filename)).deps;
      expect(res[0].depName).toBe('flask');
      expect(res[0].currentValue).toBe('');
      expect(res[0].skipReason).toBe('path-dependency');
      expect(res).toHaveLength(2);
    });
    it('skips path dependencies with version', async () => {
      const content =
        '[tool.poetry.dependencies]\r\nflask = {path = "/some/path/", version = "1.2.3"}\r\nwerkzeug = ">=0.14"';
      const res = (await extractPackageFile(content, filename)).deps;
      expect(res[0].depName).toBe('flask');
      expect(res[0].currentValue).toBe('1.2.3');
      expect(res[0].skipReason).toBe('path-dependency');
      expect(res).toHaveLength(2);
    });
  });
});
