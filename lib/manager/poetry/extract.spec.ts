import { fs, loadFixture } from '../../../test/util';
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

describe('manager/poetry/extract', () => {
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
      expect(res).toMatchObject({
        registryUrls: ['https://pypi.org/pypi/', 'https://bar.baz/+simple/'],
      });
    });
    it('extracts mixed versioning types', async () => {
      const res = await extractPackageFile(pyproject9toml, filename);
      expect(res).toMatchSnapshot({
        deps: [
          { depName: 'dep1', currentValue: '0.2' },
          { depName: 'dep2', currentValue: '1.1.0' },
          { depName: 'dep3', currentValue: '1.0a1' },
          { depName: 'dep4', currentValue: '1.0b2' },
          { depName: 'dep5', currentValue: '1.0rc1' },
          { depName: 'dep6', currentValue: '1.0.dev4' },
          { depName: 'dep7', currentValue: '1.0c1' },
          { depName: 'dep8', currentValue: '2012.2' },
          { depName: 'dep9', currentValue: '1.0.dev456' },
          { depName: 'dep10', currentValue: '1.0a1' },
          { depName: 'dep11', currentValue: '1.0a2.dev456' },
          { depName: 'dep12', currentValue: '1.0a12.dev456' },
          { depName: 'dep13', currentValue: '1.0a12' },
          { depName: 'dep14', currentValue: '1.0b1.dev456' },
          { depName: 'dep15', currentValue: '1.0b2' },
          { depName: 'dep16', currentValue: '1.0b2.post345.dev456' },
          { depName: 'dep17', currentValue: '1.0b2.post345' },
          { depName: 'dep18', currentValue: '1.0rc1.dev456' },
          { depName: 'dep19', currentValue: '1.0rc1' },
          { depName: 'dep20', currentValue: '1.0' },
          { depName: 'dep21', currentValue: '1.0+abc.5' },
          { depName: 'dep22', currentValue: '1.0+abc.7' },
          { depName: 'dep23', currentValue: '1.0+5' },
          { depName: 'dep24', currentValue: '1.0.post456.dev34' },
          { depName: 'dep25', currentValue: '1.0.post456' },
          { depName: 'dep26', currentValue: '1.1.dev1' },
          { depName: 'dep27', currentValue: '~=3.1' },
          { depName: 'dep28', currentValue: '~=3.1.2' },
          { depName: 'dep29', currentValue: '~=3.1a1' },
          { depName: 'dep30', currentValue: '==3.1' },
          { depName: 'dep31', currentValue: '==3.1.*' },
          { depName: 'dep32', currentValue: '~=3.1.0, !=3.1.3' },
          { depName: 'dep33', currentValue: '<=2.0' },
          { depName: 'dep34', currentValue: '<2.0' },
        ],
      });
    });
    it('resolves lockedVersions from the lockfile', async () => {
      fs.readLocalFile.mockResolvedValue(pyproject11tomlLock);
      const res = await extractPackageFile(pyproject11toml, filename);
      expect(res).toMatchSnapshot({
        constraints: { python: '^3.9' },
        deps: [{ lockedVersion: '1.17.5' }],
      });
    });
    it('skips git dependencies', async () => {
      const content =
        '[tool.poetry.dependencies]\r\nflask = {git = "https://github.com/pallets/flask.git"}\r\nwerkzeug = ">=0.14"';
      const res = (await extractPackageFile(content, filename)).deps;
      expect(res[0].depName).toBe('flask');
      expect(res[0].currentValue).toBeEmptyString();
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
