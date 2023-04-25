import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

const pdmPyProject = Fixtures.get('pyproject_with_pdm.toml');

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
        'pyproject.toml'
      );
      expect(result).toBeNull();
    });

    it('should return dependencies for valid content', function () {
      const result = extractPackageFile(pdmPyProject, 'pyproject.toml');

      const dependencies = result?.deps.filter(
        (dep) => dep.depType === 'project.dependencies'
      );
      expect(dependencies).toEqual([
        {
          packageName: 'blinker',
          datasource: 'pypi',
          depType: 'project.dependencies',
          skipReason: 'invalid-value',
        },
        {
          packageName: 'packaging',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=20.9,!=22.0',
        },
        {
          packageName: 'rich',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=12.3.0',
        },
        {
          packageName: 'virtualenv',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=20',
        },
        {
          packageName: 'pyproject-hooks',
          datasource: 'pypi',
          depType: 'project.dependencies',
          skipReason: 'invalid-value',
        },
        {
          packageName: 'unearth',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=0.9.0',
        },
        {
          packageName: 'tomlkit',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=0.11.1,<1',
        },
        {
          packageName: 'installer',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '<0.8,>=0.7',
        },
        {
          packageName: 'cachecontrol',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=0.12.11',
        },
        {
          packageName: 'tomli',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=1.1.0',
        },
        {
          packageName: 'typing-extensions',
          datasource: 'pypi',
          depType: 'project.dependencies',
          skipReason: 'invalid-value',
        },
        {
          packageName: 'importlib-metadata',
          datasource: 'pypi',
          depType: 'project.dependencies',
          currentValue: '>=3.6',
        },
      ]);

      const optionalDependencies = result?.deps.filter(
        (dep) => dep.depType === 'project.optional-dependencies'
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
          skipReason: 'invalid-value',
          depName: 'pytest/pytest-mock',
        },
      ]);

      const pdmDevDependencies = result?.deps.filter(
        (dep) => dep.depType === 'tool.pdm.dev-dependencies'
      );
      expect(pdmDevDependencies).toEqual([
        {
          packageName: 'pdm',
          datasource: 'pypi',
          depType: 'tool.pdm.dev-dependencies',
          skipReason: 'invalid-value',
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
          skipReason: 'invalid-value',
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
  });
});
