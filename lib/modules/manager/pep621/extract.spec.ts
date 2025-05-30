import { codeBlock } from 'common-tags';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { depTypes } from './utils';
import { extractPackageFile } from '.';
import { Fixtures } from '~test/fixtures';
import { fs } from '~test/util';

vi.mock('../../../util/fs');

const pdmPyProject = Fixtures.get('pyproject_with_pdm.toml');
const pdmSourcesPyProject = Fixtures.get('pyproject_pdm_sources.toml');

describe('modules/manager/pep621/extract', () => {
  describe('extractPackageFile()', () => {
    it('should return null for empty content', async () => {
      const result = await extractPackageFile('', 'pyproject.toml');
      expect(result).toBeNull();
    });

    it('should return null for invalid toml', async () => {
      const result = await extractPackageFile(
        codeBlock`
        [project]
        name =
      `,
        'pyproject.toml',
      );
      expect(result).toBeNull();
    });

    it('should return dependencies for valid content', async () => {
      const result = await extractPackageFile(pdmPyProject, 'pyproject.toml');

      expect(result).toMatchObject({
        extractedConstraints: {
          python: '>=3.7',
        },
      });
      const dependencies = result?.deps.filter(
        (dep) => dep.depType === 'project.dependencies',
      );
      expect(dependencies).toEqual([
        {
          packageName: 'blinker',
          depName: 'blinker',
          datasource: 'pypi',
          depType: 'project.dependencies',
          skipReason: 'unspecified-version',
        },
        {
          packageName: 'packaging',
          depName: 'packaging',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=20.9,!=22.0',
        },
        {
          packageName: 'rich',
          depName: 'rich',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=12.3.0',
        },
        {
          packageName: 'virtualenv',
          depName: 'virtualenv',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '==20.0.0',
          currentVersion: '20.0.0',
        },
        {
          packageName: 'pyproject-hooks',
          depName: 'pyproject-hooks',
          datasource: 'pypi',
          depType: 'project.dependencies',
          skipReason: 'unspecified-version',
        },
        {
          packageName: 'unearth',
          depName: 'unearth',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=0.9.0',
        },
        {
          packageName: 'tomlkit',
          depName: 'tomlkit',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=0.11.1,<1',
        },
        {
          packageName: 'installer',
          depName: 'installer',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '<0.8,>=0.7',
        },
        {
          packageName: 'cachecontrol',
          depName: 'cachecontrol',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=0.12.11',
        },
        {
          packageName: 'tomli',
          depName: 'tomli',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=1.1.0',
        },
        {
          packageName: 'typing-extensions',
          depName: 'typing-extensions',
          datasource: 'pypi',
          depType: 'project.dependencies',
          skipReason: 'unspecified-version',
        },
        {
          packageName: 'importlib-metadata',
          depName: 'importlib-metadata',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=3.6',
        },
      ]);

      const optionalDependencies = result?.deps.filter(
        (dep) => dep.depType === 'project.optional-dependencies',
      );
      expect(optionalDependencies).toEqual([
        {
          packageName: 'pytest',
          datasource: 'pypi',
          depType: 'project.optional-dependencies',
          currentValue: '>12',
          depName: 'pytest',
          managerData: { depGroup: 'pytest' },
        },
        {
          packageName: 'pytest-mock',
          datasource: 'pypi',
          depType: 'project.optional-dependencies',
          skipReason: 'unspecified-version',
          depName: 'pytest-mock',
          managerData: { depGroup: 'pytest' },
        },
      ]);

      const dependenciesFromDependencyGroups = result?.deps.filter(
        (dep) => dep.depType === 'dependency-groups',
      );
      expect(dependenciesFromDependencyGroups).toEqual([
        {
          packageName: 'mypy',
          datasource: 'pypi',
          depType: 'dependency-groups',
          currentValue: '==1.13.0',
          currentVersion: '1.13.0',
          depName: 'mypy',
          managerData: { depGroup: 'typing' },
        },
        {
          packageName: 'types-requests',
          datasource: 'pypi',
          depType: 'dependency-groups',
          skipReason: 'unspecified-version',
          depName: 'types-requests',
          managerData: { depGroup: 'typing' },
        },
        {
          packageName: 'pytest-cov',
          datasource: 'pypi',
          depType: 'dependency-groups',
          currentValue: '==5.0.0',
          currentVersion: '5.0.0',
          depName: 'pytest-cov',
          managerData: { depGroup: 'coverage' },
        },
        {
          packageName: 'click',
          datasource: 'pypi',
          depType: 'dependency-groups',
          currentValue: '==8.1.7',
          currentVersion: '8.1.7',
          depName: 'click',
          managerData: { depGroup: 'all' },
        },
      ]);

      const pdmDevDependencies = result?.deps.filter(
        (dep) => dep.depType === 'tool.pdm.dev-dependencies',
      );
      expect(pdmDevDependencies).toEqual([
        {
          packageName: 'pdm',
          datasource: 'pypi',
          depType: 'tool.pdm.dev-dependencies',
          skipReason: 'unspecified-version',
          depName: 'pdm',
          managerData: { depGroup: 'test' },
        },
        {
          packageName: 'pytest-rerunfailures',
          datasource: 'pypi',
          depType: 'tool.pdm.dev-dependencies',
          currentValue: '>=10.2',
          depName: 'pytest-rerunfailures',
          managerData: { depGroup: 'test' },
        },
        {
          packageName: 'tox',
          datasource: 'pypi',
          depType: 'tool.pdm.dev-dependencies',
          skipReason: 'unspecified-version',
          depName: 'tox',
          managerData: { depGroup: 'tox' },
        },
        {
          packageName: 'tox-pdm',
          datasource: 'pypi',
          depType: 'tool.pdm.dev-dependencies',
          currentValue: '>=0.5',
          depName: 'tox-pdm',
          managerData: { depGroup: 'tox' },
        },
      ]);
    });

    it('should return dependencies with overwritten pypi registryUrl', async () => {
      const result = await extractPackageFile(
        pdmSourcesPyProject,
        'pyproject.toml',
      );

      expect(result?.deps).toEqual([
        {
          commitMessageTopic: 'Python',
          currentValue: '>=3.7',
          datasource: 'python-version',
          depType: 'requires-python',
          packageName: 'python',
          versioning: 'pep440',
        },
        {
          packageName: 'blinker',
          depName: 'blinker',
          datasource: 'pypi',
          depType: 'project.dependencies',
          skipReason: 'unspecified-version',
          registryUrls: [
            'https://private-site.org/pypi/simple',
            'https://private.pypi.org/simple',
          ],
        },
        {
          packageName: 'packaging',
          depName: 'packaging',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=20.9,!=22.0',
          registryUrls: [
            'https://private-site.org/pypi/simple',
            'https://private.pypi.org/simple',
          ],
        },
        {
          packageName: 'pytest',
          datasource: 'pypi',
          depType: 'project.optional-dependencies',
          currentValue: '>12',
          depName: 'pytest',
          registryUrls: [
            'https://private-site.org/pypi/simple',
            'https://private.pypi.org/simple',
          ],
          managerData: { depGroup: 'pytest' },
        },
        {
          packageName: 'pytest-rerunfailures',
          datasource: 'pypi',
          depType: 'tool.pdm.dev-dependencies',
          currentValue: '>=10.2',
          depName: 'pytest-rerunfailures',
          registryUrls: [
            'https://private-site.org/pypi/simple',
            'https://private.pypi.org/simple',
          ],
          managerData: { depGroup: 'test' },
        },
        {
          packageName: 'tox-pdm',
          datasource: 'pypi',
          depType: 'tool.pdm.dev-dependencies',
          currentValue: '>=0.5',
          depName: 'tox-pdm',
          registryUrls: [
            'https://private-site.org/pypi/simple',
            'https://private.pypi.org/simple',
          ],
          managerData: { depGroup: 'tox' },
        },
      ]);
    });

    it('should return dependencies with original pypi registryUrl', async () => {
      const result = await extractPackageFile(
        codeBlock`
      [project]
      dependencies = [
        "packaging>=20.9,!=22.0",
      ]

      [[tool.pdm.source]]
      url = "https://private-site.org/pypi/simple"
      verify_ssl = true
      name = "internal"
      `,
        'pyproject.toml',
      );

      expect(result?.deps).toEqual([
        {
          packageName: 'packaging',
          depName: 'packaging',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=20.9,!=22.0',
          registryUrls: [
            'https://pypi.org/pypi/',
            'https://private-site.org/pypi/simple',
          ],
        },
      ]);
    });

    it('should skip dependencies with unsupported uv sources', async () => {
      const result = await extractPackageFile(
        codeBlock`
        [project]
        dependencies = [
          "dep1",
          "dep2",
          "dep3",
          "dep4",
          "dep5",
          "dep6",
          "dep-with_NORMALIZATION",
        ]

        [tool.uv.sources]
        dep2 = { git = "https://github.com/foo/bar" }
        dep3 = { path = "/local-dep.whl" }
        dep4 = { url = "https://example.com" }
        dep5 = { workspace = true }
        dep_WITH-normalization = { workspace = true }
        `,
        'pyproject.toml',
      );

      expect(result?.deps).toMatchObject([
        {
          depName: 'dep1',
        },
        {
          depName: 'dep2',
          depType: depTypes.uvSources,
          datasource: GitRefsDatasource.id,
          packageName: 'https://github.com/foo/bar',
          currentValue: undefined,
          skipReason: 'unspecified-version',
        },
        {
          depName: 'dep3',
          depType: depTypes.uvSources,
          skipReason: 'path-dependency',
        },
        {
          depName: 'dep4',
          depType: depTypes.uvSources,
          skipReason: 'unsupported-url',
        },
        {
          depName: 'dep5',
          depType: depTypes.uvSources,
          skipReason: 'inherited-dependency',
        },
        {
          depName: 'dep6',
        },
        {
          depName: 'dep-with_NORMALIZATION',
          depType: depTypes.uvSources,
          skipReason: 'inherited-dependency',
        },
      ]);
    });

    it('should extract dependencies from hatch environments', async () => {
      const hatchPyProject = Fixtures.get('pyproject_with_hatch.toml');
      const result = await extractPackageFile(hatchPyProject, 'pyproject.toml');

      expect(result?.deps).toEqual([
        {
          currentValue: '==2.30.0',
          currentVersion: '2.30.0',
          datasource: 'pypi',
          depName: 'requests',
          depType: 'project.dependencies',
          packageName: 'requests',
        },
        {
          datasource: 'pypi',
          depName: 'hatchling',
          depType: 'build-system.requires',
          packageName: 'hatchling',
          skipReason: 'unspecified-version',
        },
        {
          currentValue: '==6.5',
          currentVersion: '6.5',
          datasource: 'pypi',
          depName: 'coverage',
          depType: 'tool.hatch.envs.default',
          packageName: 'coverage',
        },
        {
          datasource: 'pypi',
          depName: 'pytest',
          depType: 'tool.hatch.envs.default',
          packageName: 'pytest',
          skipReason: 'unspecified-version',
        },
        {
          currentValue: '>=23.1.0',
          datasource: 'pypi',
          depName: 'black',
          depType: 'tool.hatch.envs.lint',
          packageName: 'black',
        },
        {
          datasource: 'pypi',
          depName: 'baz',
          depType: 'tool.hatch.envs.experimental',
          packageName: 'baz',
          skipReason: 'unspecified-version',
        },
      ]);
    });

    it('should extract project version', async () => {
      const content = codeBlock`
        [project]
        name = "test"
        version = "0.0.2"
        dependencies = [ "requests==2.30.0" ]
      `;

      const res = await extractPackageFile(content, 'pyproject.toml');
      expect(res?.packageFileVersion).toBe('0.0.2');
    });

    it('should extract dependencies from build-system.requires', async () => {
      const content = codeBlock`
        [build-system]
        requires = ["hatchling==1.18.0", "setuptools==69.0.3"]
        build-backend = "hatchling.build"

        [project]
        name = "test"
        version = "0.0.2"
        dependencies = [ "requests==2.30.0" ]
      `;
      const result = await extractPackageFile(content, 'pyproject.toml');

      expect(result?.deps).toEqual([
        {
          currentValue: '==2.30.0',
          currentVersion: '2.30.0',
          datasource: 'pypi',
          depName: 'requests',
          depType: 'project.dependencies',
          packageName: 'requests',
        },
        {
          currentValue: '==1.18.0',
          currentVersion: '1.18.0',
          datasource: 'pypi',
          depName: 'hatchling',
          depType: 'build-system.requires',
          packageName: 'hatchling',
        },
        {
          currentValue: '==69.0.3',
          currentVersion: '69.0.3',
          datasource: 'pypi',
          depName: 'setuptools',
          depType: 'build-system.requires',
          packageName: 'setuptools',
        },
      ]);
    });

    it('should resolve lockedVersions from pdm.lock', async () => {
      fs.readLocalFile.mockResolvedValue(
        Fixtures.get('pyproject_pdm_lockedversion.lock'),
      );

      const res = await extractPackageFile(
        Fixtures.get('pyproject_pdm_lockedversion.toml'),
        'pyproject.toml',
      );
      expect(res).toMatchObject({
        extractedConstraints: { python: '>=3.11' },
        deps: [
          {
            commitMessageTopic: 'Python',
            currentValue: '>=3.11',
            datasource: 'python-version',
            depType: 'requires-python',
            packageName: 'python',
            versioning: 'pep440',
          },
          {
            packageName: 'jwcrypto',
            depName: 'jwcrypto',
            datasource: 'pypi',
            depType: 'project.dependencies',
            currentValue: '>=1.4.1',
            lockedVersion: '1.4.1',
          },
          {
            packageName: 'pdm-backend',
            depName: 'pdm-backend',
            datasource: 'pypi',
            depType: 'build-system.requires',
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('should resolve lockedVersions from uv.lock', async () => {
      fs.readLocalFile.mockResolvedValue(
        codeBlock`
          version = 1
          requires-python = ">=3.11"

          [[package]]
          name = "attrs"
          version = "24.2.0"
          source = { registry = "https://pypi.org/simple" }
          sdist = { url = "https://files.pythonhosted.org/packages/fc/0f/aafca9af9315aee06a89ffde799a10a582fe8de76c563ee80bbcdc08b3fb/attrs-24.2.0.tar.gz", hash = "sha256:5cfb1b9148b5b086569baec03f20d7b6bf3bcacc9a42bebf87ffaaca362f6346", size = 792678 }
          wheels = [
              { url = "https://files.pythonhosted.org/packages/6a/21/5b6702a7f963e95456c0de2d495f67bf5fd62840ac655dc451586d23d39a/attrs-24.2.0-py3-none-any.whl", hash = "sha256:81921eb96de3191c8258c199618104dd27ac608d9366f5e35d011eae1867ede2", size = 63001 },
          ]

          [[package]]
          name = "pep621-uv"
          version = "0.1.0"
          source = { virtual = "." }
          dependencies = [
              { name = "attrs" },
          ]

          [package.metadata]
          requires-dist = [{ name = "attrs", specifier = ">=24.1.0" }]
        `,
      );

      const res = await extractPackageFile(
        codeBlock`
          [project]
          name = "pep621-uv"
          version = "0.1.0"
          dependencies = ["attrs>=24.1.0"]
          requires-python = ">=3.11"
        `,
        'pyproject.toml',
      );
      expect(res).toMatchObject({
        extractedConstraints: { python: '>=3.11' },
        deps: [
          {
            commitMessageTopic: 'Python',
            currentValue: '>=3.11',
            datasource: 'python-version',
            depType: 'requires-python',
            packageName: 'python',
            versioning: 'pep440',
          },
          {
            packageName: 'attrs',
            depName: 'attrs',
            datasource: 'pypi',
            depType: 'project.dependencies',
            currentValue: '>=24.1.0',
            lockedVersion: '24.2.0',
          },
        ],
      });
    });

    it('should resolve dependencies without locked versions on invalid uv.lock', async () => {
      fs.readLocalFile.mockResolvedValue(codeBlock`invalid_toml`);

      const res = await extractPackageFile(
        codeBlock`
          [project]
          name = "pep621-uv"
          version = "0.1.0"
          dependencies = ["attrs>=24.1.0"]
          requires-python = ">=3.11"
        `,
        'pyproject.toml',
      );
      expect(res).toMatchObject({
        extractedConstraints: { python: '>=3.11' },
        deps: [
          {
            packageName: 'python',
            depType: 'requires-python',
            datasource: 'python-version',
            versioning: 'pep440',
          },
          {
            packageName: 'attrs',
            depName: 'attrs',
            datasource: 'pypi',
            depType: 'project.dependencies',
            currentValue: '>=24.1.0',
          },
        ],
      });
    });

    it('should resolve dependencies with template', async () => {
      const content = codeBlock`
            [project]
            name = "{{ name }}"
            dynamic = ["version"]
            requires-python = ">=3.7"
            license = {text = "MIT"}
            {# comment #}
            dependencies = [
              "blinker",
              {% if foo %}
              "packaging>=20.9,!=22.0",
              {% endif %}
            ]
            readme = "README.md"
          `;
      const res = await extractPackageFile(content, 'pyproject.toml');
      expect(res?.deps).toHaveLength(3);
    });
  });
});
