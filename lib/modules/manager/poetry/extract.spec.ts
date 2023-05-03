import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { fs } from '../../../../test/util';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { extractPackageFile } from '.';

jest.mock('../../../util/fs');

const pyproject1toml = Fixtures.get('pyproject.1.toml');
const pyproject2toml = Fixtures.get('pyproject.2.toml');
const pyproject3toml = Fixtures.get('pyproject.3.toml');
const pyproject4toml = Fixtures.get('pyproject.4.toml');
const pyproject5toml = Fixtures.get('pyproject.5.toml');
const pyproject6toml = Fixtures.get('pyproject.6.toml');
const pyproject7toml = Fixtures.get('pyproject.7.toml');
const pyproject8toml = Fixtures.get('pyproject.8.toml');
const pyproject9toml = Fixtures.get('pyproject.9.toml');

// pyproject.10.toml use by artifacts
const pyproject11toml = Fixtures.get('pyproject.11.toml');
const pyproject11tomlLock = Fixtures.get('pyproject.11.toml.lock');

const pyproject12toml = Fixtures.get('pyproject.12.toml');

describe('modules/manager/poetry/extract', () => {
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
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(9);
      expect(res?.extractedConstraints).toEqual({
        python: '~2.7 || ^3.4',
      });
    });

    it('extracts multiple dependencies (with dep = {version = "1.2.3"} case)', async () => {
      const res = await extractPackageFile(pyproject2toml, filename);
      expect(res).toMatchSnapshot();
      expect(res?.deps).toHaveLength(7);
    });

    it('handles case with no dependencies', async () => {
      const res = await extractPackageFile(pyproject3toml, filename);
      expect(res).toBeNull();
    });

    it('handles multiple constraint dependencies', async () => {
      const res = await extractPackageFile(pyproject4toml, filename);
      expect(res).toMatchSnapshot();
      expect(res?.deps).toHaveLength(1);
    });

    it('can parse TOML v1 heterogeneous arrays', async () => {
      const res = await extractPackageFile(pyproject12toml, filename);
      expect(res).not.toBeNull();
      expect(res?.deps).toHaveLength(2);
    });

    it('extracts registries', async () => {
      const res = await extractPackageFile(pyproject6toml, filename);
      expect(res?.registryUrls).toMatchSnapshot();
      expect(res?.registryUrls).toHaveLength(3);
    });

    it('can parse empty registries', async () => {
      const res = await extractPackageFile(pyproject7toml, filename);
      expect(res?.registryUrls).toBeUndefined();
    });

    it('can parse missing registries', async () => {
      const res = await extractPackageFile(pyproject1toml, filename);
      expect(res?.registryUrls).toBeUndefined();
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

    it('extracts dependencies from dependency groups', async () => {
      const content = codeBlock`
        [tool.poetry.dependencies]
        dep = "^2.0"


        [tool.poetry.group.dev.dependencies]
        dev_dep = "^3.0"

        [tool.poetry.group.typing.dependencies]
        typing_dep = "^4.0"
      `;
      const res = await extractPackageFile(content, filename);
      expect(res?.deps).toMatchObject([
        {
          currentValue: '^2.0',
          datasource: 'pypi',
          depName: 'dep',
          depType: 'dependencies',
        },
        {
          currentValue: '^3.0',
          datasource: 'pypi',
          depName: 'dev_dep',
          depType: 'dev',
          packageName: 'dev-dep',
        },
        {
          currentValue: '^4.0',
          datasource: 'pypi',
          depName: 'typing_dep',
          depType: 'typing',
          packageName: 'typing-dep',
        },
      ]);
    });

    it('resolves lockedVersions from the lockfile', async () => {
      fs.readLocalFile.mockResolvedValue(pyproject11tomlLock);
      const res = await extractPackageFile(pyproject11toml, filename);
      expect(res).toMatchSnapshot({
        extractedConstraints: { python: '^3.9' },
        deps: [{ lockedVersion: '1.17.5' }],
      });
    });

    it('parses github dependencies tags on ssh urls', async () => {
      const content = codeBlock`
        [tool.poetry.dependencies]
        fastapi = {git = "git@github.com:tiangolo/fastapi.git", tag="1.2.3"}
        werkzeug = ">=0.14"
      `;
      const res = (await extractPackageFile(content, filename))!.deps;
      expect(res[0].depName).toBe('fastapi');
      expect(res[0].packageName).toBe('tiangolo/fastapi');
      expect(res[0].currentValue).toBe('1.2.3');
      expect(res[0].skipReason).toBeUndefined();
      expect(res[0].datasource).toBe(GithubTagsDatasource.id);
      expect(res).toHaveLength(2);
    });

    it('parses github dependencies tags on http urls', async () => {
      const content = codeBlock`
        [tool.poetry.dependencies]
        fastapi = {git = "https://github.com/tiangolo/fastapi.git", tag="1.2.3"}
        werkzeug = ">=0.14"
      `;
      const res = (await extractPackageFile(content, filename))!.deps;
      expect(res[0].depName).toBe('fastapi');
      expect(res[0].packageName).toBe('tiangolo/fastapi');
      expect(res[0].currentValue).toBe('1.2.3');
      expect(res[0].skipReason).toBeUndefined();
      expect(res[0].datasource).toBe(GithubTagsDatasource.id);
      expect(res).toHaveLength(2);
    });

    it('skips git dependencies', async () => {
      const content = codeBlock`
        [tool.poetry.dependencies]
        flask = {git = "https://github.com/pallets/flask.git"}
        werkzeug = ">=0.14"
      `;
      const res = (await extractPackageFile(content, filename))!.deps;
      expect(res[0].depName).toBe('flask');
      expect(res[0].currentValue).toBeEmptyString();
      expect(res[0].skipReason).toBe('git-dependency');
      expect(res).toHaveLength(2);
    });

    it('skips git dependencies with version', async () => {
      const content = codeBlock`
        [tool.poetry.dependencies]
        flask = {git = "https://github.com/pallets/flask.git", version="1.2.3"}
        werkzeug = ">=0.14"
      `;
      const res = (await extractPackageFile(content, filename))!.deps;
      expect(res[0].depName).toBe('flask');
      expect(res[0].currentValue).toBe('1.2.3');
      expect(res[0].skipReason).toBe('git-dependency');
      expect(res).toHaveLength(2);
    });

    it('skips git dependencies on tags that are not in github', async () => {
      const content = codeBlock`
        [tool.poetry.dependencies]
        aws-sam = {git = "https://gitlab.com/gitlab-examples/aws-sam.git", tag="1.2.3"}
      `;
      const res = (await extractPackageFile(content, filename))!.deps;
      expect(res[0].depName).toBe('aws-sam');
      expect(res[0].currentValue).toBe('1.2.3');
      expect(res[0].skipReason).toBe('git-dependency');
      expect(res).toHaveLength(1);
    });

    it('skips path dependencies', async () => {
      const content = codeBlock`
        [tool.poetry.dependencies]
        flask = {path = "/some/path/"}
        werkzeug = ">=0.14"
      `;
      const res = (await extractPackageFile(content, filename))!.deps;
      expect(res[0].depName).toBe('flask');
      expect(res[0].currentValue).toBe('');
      expect(res[0].skipReason).toBe('path-dependency');
      expect(res).toHaveLength(2);
    });

    it('skips path dependencies with version', async () => {
      const content = codeBlock`
        [tool.poetry.dependencies]
        flask = {path = "/some/path/", version = "1.2.3"}
        werkzeug = ">=0.14"
      `;
      const res = (await extractPackageFile(content, filename))!.deps;
      expect(res[0].depName).toBe('flask');
      expect(res[0].currentValue).toBe('1.2.3');
      expect(res[0].skipReason).toBe('path-dependency');
      expect(res).toHaveLength(2);
    });
  });
});
