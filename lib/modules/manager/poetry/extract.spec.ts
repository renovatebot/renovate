import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { fs } from '../../../../test/util';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PypiDatasource } from '../../datasource/pypi';
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
      expect(res?.deps).toHaveLength(10);
      expect(res?.extractedConstraints).toEqual({
        python: '~2.7 || ^3.4',
      });
    });

    it('extracts multiple dependencies (with dep = {version = "1.2.3"} case)', async () => {
      const res = await extractPackageFile(pyproject2toml, filename);
      expect(res).toMatchSnapshot();
      expect(res?.deps).toHaveLength(8);
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
      expect(res?.deps).toHaveLength(3);
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
        deps: [
          { depName: 'python', currentValue: '^3.9' },
          { depName: 'boto3', lockedVersion: '1.17.5' },
        ],
      });
    });

    it('parses git dependencies long commit hashes on http urls', async () => {
      const content = codeBlock`
        [tool.poetry.dependencies]
        fastapi = {git = "https://github.com/tiangolo/fastapi.git", rev="6f5aa81c076d22e38afbe7d602db6730e28bc3cc"}
        dep = "^2.0"
      `;
      const res = await extractPackageFile(content, filename);
      expect(res?.deps).toMatchObject([
        {
          depType: 'dependencies',
          depName: 'fastapi',
          datasource: GitRefsDatasource.id,
          currentDigest: '6f5aa81c076d22e38afbe7d602db6730e28bc3cc',
          replaceString: '6f5aa81c076d22e38afbe7d602db6730e28bc3cc',
          packageName: 'https://github.com/tiangolo/fastapi.git',
        },
        {
          depType: 'dependencies',
          depName: 'dep',
          datasource: PypiDatasource.id,
          currentValue: '^2.0',
        },
      ]);
    });

    it('parses git dependencies short commit hashes on http urls', async () => {
      const content = codeBlock`
        [tool.poetry.dependencies]
        fastapi = {git = "https://github.com/tiangolo/fastapi.git", rev="6f5aa81"}
        dep = "^2.0"
      `;
      const res = await extractPackageFile(content, filename);
      expect(res?.deps).toMatchObject([
        {
          depType: 'dependencies',
          depName: 'fastapi',
          datasource: GitRefsDatasource.id,
          currentDigest: '6f5aa81',
          replaceString: '6f5aa81',
          packageName: 'https://github.com/tiangolo/fastapi.git',
        },
        {
          depType: 'dependencies',
          depName: 'dep',
          datasource: PypiDatasource.id,
          currentValue: '^2.0',
        },
      ]);
    });

    it('parses git dependencies long commit hashes on ssh urls', async () => {
      const content = codeBlock`
        [tool.poetry.dependencies]
        fastapi = {git = "git@github.com:tiangolo/fastapi.git", rev="6f5aa81c076d22e38afbe7d602db6730e28bc3cc"}
        dep = "^2.0"
      `;
      const res = await extractPackageFile(content, filename);
      expect(res?.deps).toMatchObject([
        {
          depType: 'dependencies',
          depName: 'fastapi',
          datasource: GitRefsDatasource.id,
          currentDigest: '6f5aa81c076d22e38afbe7d602db6730e28bc3cc',
          replaceString: '6f5aa81c076d22e38afbe7d602db6730e28bc3cc',
          packageName: 'git@github.com:tiangolo/fastapi.git',
        },
        {
          depType: 'dependencies',
          depName: 'dep',
          datasource: PypiDatasource.id,
          currentValue: '^2.0',
        },
      ]);
    });

    it('parses git dependencies long commit hashes on http urls with branch marker', async () => {
      const content = codeBlock`
        [tool.poetry.dependencies]
        fastapi = {git = "https://github.com/tiangolo/fastapi.git", branch="develop", rev="6f5aa81c076d22e38afbe7d602db6730e28bc3cc"}
        dep = "^2.0"
      `;
      const res = await extractPackageFile(content, filename);
      expect(res?.deps).toMatchObject([
        {
          depType: 'dependencies',
          depName: 'fastapi',
          datasource: GitRefsDatasource.id,
          currentValue: 'develop',
          currentDigest: '6f5aa81c076d22e38afbe7d602db6730e28bc3cc',
          replaceString: '6f5aa81c076d22e38afbe7d602db6730e28bc3cc',
          packageName: 'https://github.com/tiangolo/fastapi.git',
        },
        {
          depType: 'dependencies',
          depName: 'dep',
          datasource: PypiDatasource.id,
          currentValue: '^2.0',
        },
      ]);
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

    it('parses git dependencies with tags that are not on GitHub', async () => {
      const content = codeBlock`
        [tool.poetry.dependencies]
        aws-sam = {git = "https://gitlab.com/gitlab-examples/aws-sam.git", tag="1.2.3"}
        platform-tools = {git = "https://some.company.com/platform-tools", tag="1.2.3"}
      `;
      const res = await extractPackageFile(content, filename);
      expect(res?.deps).toMatchObject([
        {
          datasource: 'gitlab-tags',
          depName: 'aws-sam',
          packageName: 'gitlab-examples/aws-sam',
          currentValue: '1.2.3',
        },
        {
          datasource: 'git-tags',
          depName: 'platform-tools',
          packageName: 'https://some.company.com/platform-tools',
          currentValue: '1.2.3',
        },
      ]);
    });

    it('skips git dependencies', async () => {
      const content = codeBlock`
        [tool.poetry.dependencies]
        flask = {git = "https://github.com/pallets/flask.git"}
        werkzeug = ">=0.14"
      `;
      const res = (await extractPackageFile(content, filename))!.deps;
      expect(res[0].depName).toBe('flask');
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

    it('skips path dependencies', async () => {
      const content = codeBlock`
        [tool.poetry.dependencies]
        flask = {path = "/some/path/"}
        werkzeug = ">=0.14"
      `;
      const res = (await extractPackageFile(content, filename))!.deps;
      expect(res[0].depName).toBe('flask');
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

    it('does not include registry url for dependency python', async () => {
      const content = codeBlock`
        [tool.poetry.dependencies]
        python = "^3.11"

        [[tool.poetry.source]]
        name = "custom-source"
        url = "https://example.com"
        priority = "explicit"
      `;
      const res = (await extractPackageFile(content, filename))!.deps;
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({
        depName: 'python',
        packageName: 'containerbase/python-prebuild',
        currentValue: '^3.11',
        datasource: GithubReleasesDatasource.id,
        commitMessageTopic: 'Python',
        registryUrls: null,
      });
    });

    describe('registry URLs', () => {
      it('can parse empty registries', async () => {
        const res = await extractPackageFile(pyproject7toml, filename);
        expect(res?.registryUrls).toBeUndefined();
      });

      it('can parse missing registries', async () => {
        const res = await extractPackageFile(pyproject1toml, filename);
        expect(res?.registryUrls).toBeUndefined();
      });

      it('extracts registries', async () => {
        const res = await extractPackageFile(pyproject6toml, filename);
        expect(res?.registryUrls).toMatchObject([
          'https://foo.bar/simple/',
          'https://bar.baz/+simple/',
          'https://pypi.org/pypi/',
        ]);
      });

      it('dedupes registries', async () => {
        const res = await extractPackageFile(pyproject8toml, filename);
        expect(res?.registryUrls).toMatchObject([
          'https://pypi.org/pypi/',
          'https://bar.baz/+simple/',
        ]);
      });

      it('source with priority="default" and implicit PyPI priority="primary"', async () => {
        const content = codeBlock`
          [tool.poetry.dependencies]
          python = "^3.11"

          [[tool.poetry.source]]
          name = "foo"
          url = "https://foo.bar/simple/"
          priority = "default"

          [[tool.poetry.source]]
          name = "PyPI"
        `;
        const res = await extractPackageFile(content, filename);
        expect(res?.registryUrls).toMatchObject([
          'https://foo.bar/simple/',
          'https://pypi.org/pypi/',
        ]);
      });

      it('source with implicit priority and PyPI with priority="explicit"', async () => {
        const content = codeBlock`
          [tool.poetry.dependencies]
          python = "^3.11"

          [[tool.poetry.source]]
          name = "foo"
          url = "https://foo.bar/simple/"

          [[tool.poetry.source]]
          name = "PyPI"
          priority = "explicit"
        `;
        const res = await extractPackageFile(content, filename);
        expect(res?.registryUrls).toMatchObject(['https://foo.bar/simple/']);
      });

      it('supports dependencies with explicit source', async () => {
        const content = codeBlock`
        [tool.poetry.dependencies]
        attrs = "^23.1.0"
        typer = { version = "^0.9.0", source = "pypi" }
        requests-cache = { version = "^1.1.0", source = "artifactory" }

        [[tool.poetry.source]]
        name = "artifactory"
        url = "https://example.com"
        priority = "explicit"
      `;
        const res = await extractPackageFile(content, filename);
        expect(res?.deps).toMatchObject([
          { depName: 'attrs', currentValue: '^23.1.0' },
          {
            depName: 'typer',
            currentValue: '^0.9.0',
            registryUrls: ['https://pypi.org/pypi/'],
          },
          {
            depName: 'requests-cache',
            currentValue: '^1.1.0',
            registryUrls: ['https://example.com'],
          },
        ]);
      });
    });
  });
});
