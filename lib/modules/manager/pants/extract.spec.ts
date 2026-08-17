import { codeBlock } from 'common-tags';
import upath from 'upath';
import { Fixtures } from '~test/fixtures.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import { extractAllPackageFiles, extractPackageFile } from './index.ts';

const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  localDir: upath.resolve('lib/modules/manager/pants/__fixtures__'),
};

describe('modules/manager/pants/extract', () => {
  // pep621 resolves lockfiles relative to `localDir`, so the delegating tests
  // need a repository root even when they pass content in directly.
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  describe('extractPackageFile()', () => {
    it('returns null for a build file without requirements', async () => {
      const content = codeBlock`
        python_sources(name="lib")
        python_requirements(name="reqs", source="requirements.txt")
      `;
      expect(await extractPackageFile(content, 'BUILD.pants')).toBeNull();
    });

    it('returns null for unparseable content', async () => {
      expect(
        await extractPackageFile('!!! not python', 'BUILD.pants'),
      ).toBeNull();
    });

    it('extracts python_requirement targets', async () => {
      const res = await extractPackageFile(
        Fixtures.get('BUILD.pants'),
        'BUILD.pants',
      );
      expect(res).toEqual({
        deps: [
          {
            datasource: 'pypi',
            depName: 'pytest-mock',
            packageName: 'pytest-mock',
            currentValue: '>=3.12,<4',
            depType: 'python_requirement',
            replaceString: 'pytest-mock>=3.12,<4',
          },
          {
            datasource: 'pypi',
            depName: 'fancycompleter',
            packageName: 'fancycompleter',
            currentValue: '<=0.10.0',
            depType: 'python_requirement',
            replaceString: 'fancycompleter<=0.10.0',
          },
          {
            datasource: 'pypi',
            depName: 'requests',
            packageName: 'requests',
            currentValue: '==2.31.0',
            currentVersion: '2.31.0',
            depType: 'python_requirement',
            replaceString: 'requests[security]==2.31.0',
          },
          {
            datasource: 'pypi',
            depName: 'types-protobuf',
            packageName: 'types-protobuf',
            currentValue: undefined,
            depType: 'python_requirement',
            replaceString: 'types-protobuf',
          },
        ],
      });
    });

    it('handles the plain BUILD file name', async () => {
      const content = codeBlock`
        python_requirement(requirements=["click==8.1.7"])
      `;
      expect((await extractPackageFile(content, 'BUILD'))?.deps).toMatchObject([
        { depName: 'click', depType: 'python_requirement' },
      ]);
    });

    it('ignores strings outside the supported fields', async () => {
      const content = codeBlock`
        python_requirements(
            name="reqs",
            source="reqs.txt",
            module_mapping={"pillow": ["PIL"]},
            overrides={"fastapi": {"dependencies": ["orjson==3.9.0"]}},
        )
      `;
      expect(await extractPackageFile(content, 'BUILD.pants')).toBeNull();
    });

    it('skips requirements it cannot parse', async () => {
      const content = codeBlock`
        python_requirement(
            requirements=["==1.2.3", "click==8.1.7"],
        )
      `;
      expect(
        (await extractPackageFile(content, 'BUILD.pants'))?.deps,
      ).toMatchObject([{ depName: 'click' }]);
    });

    it('extracts VCS requirements', async () => {
      const content = codeBlock`
        python_requirement(
            requirements=["some-package @ git+https://github.com/foo/bar@v1.2.3"],
        )
      `;
      expect((await extractPackageFile(content, 'BUILD.pants'))?.deps).toEqual([
        {
          datasource: 'git-tags',
          depName: 'bar',
          packageName: 'https://github.com/foo/bar',
          currentValue: 'v1.2.3',
          currentVersion: 'v1.2.3',
          depType: 'python_requirement',
          replaceString: 'some-package @ git+https://github.com/foo/bar@v1.2.3',
        },
      ]);
    });

    it('parses a pyproject.toml source as PEP 621', async () => {
      const content = codeBlock`
        [project]
        name = "my-package"
        dependencies = ["typing-extensions>=4.8.0,<5.0.0"]
      `;
      const res = await extractPackageFile(content, 'pyproject.toml');
      expect(res?.deps).toMatchObject([
        { depName: 'typing-extensions', currentValue: '>=4.8.0,<5.0.0' },
      ]);
    });

    it('parses a requirements file as such', async () => {
      const res = await extractPackageFile(
        'click==8.1.7\n',
        'requirements.txt',
      );
      expect(res?.deps).toMatchObject([
        { depName: 'click', currentValue: '==8.1.7' },
      ]);
    });
  });

  describe('extractAllPackageFiles()', () => {
    it('returns build file deps and the referenced requirements files', async () => {
      const res = await extractAllPackageFiles({}, ['BUILD.pants']);
      expect(res).toMatchObject([
        {
          packageFile: 'BUILD.pants',
          deps: [
            { depName: 'pytest-mock' },
            { depName: 'fancycompleter' },
            { depName: 'requests' },
            { depName: 'types-protobuf' },
          ],
        },
        {
          packageFile: 'app-requirements.txt',
          deps: [
            { depName: 'fastapi', depType: 'python_requirements' },
            { depName: 'orjson', depType: 'python_requirements' },
          ],
        },
        {
          packageFile: 'requirements.txt',
          deps: [{ depName: 'click', depType: 'python_requirements' }],
        },
      ]);
    });

    it('extracts a pyproject.toml source', async () => {
      const res = await extractAllPackageFiles({}, ['pyproject/BUILD.pants']);
      expect(res).toMatchObject([
        {
          packageFile: 'pyproject/pyproject.toml',
          deps: [
            { packageName: 'python', currentValue: '>=3.12,<3.13' },
            {
              depName: 'typing-extensions',
              depType: 'project.dependencies',
            },
          ],
        },
      ]);
    });

    it('extracts a shared requirements file once', async () => {
      const res = await extractAllPackageFiles({}, [
        'BUILD.pants',
        'BUILD.pants',
      ]);
      expect(
        res.filter((f) => f.packageFile === 'requirements.txt'),
      ).toHaveLength(1);
    });

    it('skips missing files', async () => {
      expect(await extractAllPackageFiles({}, ['missing/BUILD.pants'])).toEqual(
        [],
      );
    });

    it('skips a requirements file with no deps', async () => {
      expect(await extractAllPackageFiles({}, ['empty/BUILD.pants'])).toEqual(
        [],
      );
    });

    it('skips a missing python_requirements source', async () => {
      const res = await extractAllPackageFiles({}, ['no-source/BUILD.pants']);
      expect(res).toEqual([]);
    });
  });
});
