import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const pdmPyProject = Fixtures.get('pyproject_with_pdm.toml');
const pdmSourcesPyProject = Fixtures.get('pyproject_pdm_sources.toml');

describe('modules/manager/pep621/extract', () => {
  describe('extractPackageFile()', () => {
    it('should return null for empty content', function () {
      const result = extractPackageFile('', 'pyproject.toml');
      expect(result).toBeNull();
    });

    it('should return null for invalid toml', function () {
      const result = extractPackageFile(
        codeBlock`
        [project]
        name =
      `,
        'pyproject.toml',
      );
      expect(result).toBeNull();
    });

    it('should return dependencies for valid content', function () {
      const result = extractPackageFile(pdmPyProject, 'pyproject.toml');

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
          depName: 'pytest/pytest',
        },
        {
          packageName: 'pytest-mock',
          datasource: 'pypi',
          depType: 'project.optional-dependencies',
          skipReason: 'unspecified-version',
          depName: 'pytest/pytest-mock',
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
          depName: 'test/pdm',
        },
        {
          packageName: 'pytest-rerunfailures',
          datasource: 'pypi',
          depType: 'tool.pdm.dev-dependencies',
          currentValue: '>=10.2',
          depName: 'test/pytest-rerunfailures',
        },
        {
          packageName: 'tox',
          datasource: 'pypi',
          depType: 'tool.pdm.dev-dependencies',
          skipReason: 'unspecified-version',
          depName: 'tox/tox',
        },
        {
          packageName: 'tox-pdm',
          datasource: 'pypi',
          depType: 'tool.pdm.dev-dependencies',
          currentValue: '>=0.5',
          depName: 'tox/tox-pdm',
        },
      ]);
    });

    it('should return dependencies with overwritten pypi registryUrl', function () {
      const result = extractPackageFile(pdmSourcesPyProject, 'pyproject.toml');

      expect(result?.deps).toEqual([
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
          depName: 'pytest/pytest',
          registryUrls: [
            'https://private-site.org/pypi/simple',
            'https://private.pypi.org/simple',
          ],
        },
        {
          packageName: 'pytest-rerunfailures',
          datasource: 'pypi',
          depType: 'tool.pdm.dev-dependencies',
          currentValue: '>=10.2',
          depName: 'test/pytest-rerunfailures',
          registryUrls: [
            'https://private-site.org/pypi/simple',
            'https://private.pypi.org/simple',
          ],
        },
        {
          packageName: 'tox-pdm',
          datasource: 'pypi',
          depType: 'tool.pdm.dev-dependencies',
          currentValue: '>=0.5',
          depName: 'tox/tox-pdm',
          registryUrls: [
            'https://private-site.org/pypi/simple',
            'https://private.pypi.org/simple',
          ],
        },
      ]);
    });

    it('should return dependencies with original pypi registryUrl', function () {
      const result = extractPackageFile(
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

    it('should extract dependencies from hatch environments', function () {
      const hatchPyProject = Fixtures.get('pyproject_with_hatch.toml');
      const result = extractPackageFile(hatchPyProject, 'pyproject.toml');

      expect(result?.deps).toEqual([
        {
          currentValue: '==2.30.0',
          datasource: 'pypi',
          depName: 'requests',
          depType: 'project.dependencies',
          packageName: 'requests',
        },
        {
          currentValue: '==6.5',
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
  });
});
