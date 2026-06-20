import { codeBlock } from 'common-tags';
import { describe, expect, it } from 'vitest';
import { extractPackageFile } from './extract.ts';

describe('modules/manager/tox/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid pyproject.toml', () => {
      expect(extractPackageFile('{not valid}', 'pyproject.toml')).toBeNull();
    });

    it('returns null for invalid tox.toml', () => {
      expect(extractPackageFile('not valid toml {{', 'tox.toml')).toBeNull();
    });

    it('returns null for tox.toml with no extractable deps', () => {
      expect(extractPackageFile('env_list = ["py311"]', 'tox.toml')).toBeNull();
    });

    it('returns null for pyproject.toml without [tool.tox]', () => {
      const content = codeBlock`
        [project]
        name = "foo"
        dependencies = ["requests"]
      `;
      expect(extractPackageFile(content, 'pyproject.toml')).toBeNull();
    });

    it('extracts requires from tox.toml', () => {
      const content = codeBlock`
        requires = ["tox>=4.2", "tox-uv>=1"]
      `;
      const res = extractPackageFile(content, 'tox.toml');
      expect(res).toEqual({
        deps: [
          {
            depName: 'tox',
            packageName: 'tox',
            currentValue: '>=4.2',
            datasource: 'pypi',
            depType: 'requires',
          },
          {
            depName: 'tox-uv',
            packageName: 'tox-uv',
            currentValue: '>=1',
            datasource: 'pypi',
            depType: 'requires',
          },
        ],
      });
    });

    it('extracts env_run_base deps from tox.toml', () => {
      const content = codeBlock`
        [env_run_base]
        deps = ["pytest>=7.2", "coverage"]
      `;
      const res = extractPackageFile(content, 'tox.toml');
      expect(res).toEqual({
        deps: [
          {
            depName: 'pytest',
            packageName: 'pytest',
            currentValue: '>=7.2',
            datasource: 'pypi',
            depType: 'env_run_base',
          },
          {
            depName: 'coverage',
            packageName: 'coverage',
            datasource: 'pypi',
            depType: 'env_run_base',
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('extracts named env deps from tox.toml', () => {
      const content = codeBlock`
        [env.lint]
        deps = ["ruff>=0.1"]
      `;
      const res = extractPackageFile(content, 'tox.toml');
      expect(res).toEqual({
        deps: [
          {
            depName: 'ruff',
            packageName: 'ruff',
            currentValue: '>=0.1',
            datasource: 'pypi',
            depType: 'env.lint',
          },
        ],
      });
    });

    it('skips -r, -c, prefixed entries in env_run_base deps', () => {
      const content = codeBlock`
        [env_run_base]
        deps = [
          "pytest>=7.2",
          "-r requirements-test.txt",
          "-c constraints.txt",
          "coverage>=7",
        ]
      `;
      const res = extractPackageFile(content, 'tox.toml');
      expect(res).toMatchObject({
        deps: [
          {
            depName: 'pytest',
            packageName: 'pytest',
            currentValue: '>=7.2',
            datasource: 'pypi',
            depType: 'env_run_base',
          },
          {
            depName: 'coverage',
            packageName: 'coverage',
            currentValue: '>=7',
            datasource: 'pypi',
            depType: 'env_run_base',
          },
        ],
      });
    });

    it('skips invalid dependencies', () => {
      const content = codeBlock`
        [env_run_base]
        deps = [
          "pytest>=7.2",
          "@not-valid@",
        ]
      `;
      const res = extractPackageFile(content, 'tox.toml');
      expect(res?.deps[0]).toMatchObject({
        depName: 'pytest',
        packageName: 'pytest',
        currentValue: '>=7.2',
        datasource: 'pypi',
        depType: 'env_run_base',
      });
    });

    it('skips invalid dependencies inside [env.<env-name>]', () => {
      const content = codeBlock`
        [env.docs]
        deps = [
          "sphinx>=7",
          "@not-valid@",
          "-r requirements-docs.txt",
        ]
      `;
      const res = extractPackageFile(content, 'tox.toml');
      expect(res?.deps[0]).toMatchObject({
        depName: 'sphinx',
        packageName: 'sphinx',
        currentValue: '>=7',
        datasource: 'pypi',
        depType: 'env.docs',
      });
    });

    it('extracts all sections from tox.toml', () => {
      const content = codeBlock`
        requires = ["tox>=4.2", "tox-uv>=1.7"]
        env_list = ["py311", "py312", "lint"]

        [env_run_base]
        deps = [
          "pytest>=7.2",
          "coverage[toml]>=7",
          "-r requirements-test.txt",
        ]

        [env.lint]
        deps = [
          "ruff>=0.1",
          "mypy",
        ]

        [env.docs]
        deps = ["sphinx>=7", "furo"]
      `;
      const res = extractPackageFile(content, 'tox.toml');
      expect(res).toMatchObject({
        deps: [
          {
            currentValue: '>=4.2',
            datasource: 'pypi',
            depName: 'tox',
            depType: 'requires',
            packageName: 'tox',
          },
          {
            currentValue: '>=1.7',
            datasource: 'pypi',
            depName: 'tox-uv',
            depType: 'requires',
            packageName: 'tox-uv',
          },
          {
            currentValue: '>=7.2',
            datasource: 'pypi',
            depName: 'pytest',
            depType: 'env_run_base',
            packageName: 'pytest',
          },
          {
            currentValue: '>=7',
            datasource: 'pypi',
            depName: 'coverage',
            depType: 'env_run_base',
            packageName: 'coverage',
          },
          {
            currentValue: '>=0.1',
            datasource: 'pypi',
            depName: 'ruff',
            depType: 'env.lint',
            packageName: 'ruff',
          },
          {
            datasource: 'pypi',
            depName: 'mypy',
            depType: 'env.lint',
            packageName: 'mypy',
            skipReason: 'unspecified-version',
          },
          {
            currentValue: '>=7',
            datasource: 'pypi',
            depName: 'sphinx',
            depType: 'env.docs',
            packageName: 'sphinx',
          },
          {
            datasource: 'pypi',
            depName: 'furo',
            depType: 'env.docs',
            packageName: 'furo',
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('extracts all sections from pyproject.toml', () => {
      const content = codeBlock`
        [project]
        name = "mypackage"
        version = "1.0.0"
        requires-python = ">=3.11"
        dependencies = ["requests>=2.28"]

        [tool.tox]
        requires = ["tox>=4.2", "tox-uv>=1.7"]
        env_list = ["py311", "py312", "lint"]

        [tool.tox.env_run_base]
        deps = [
          "pytest>=7.2",
          "coverage[toml]>=7",
        ]

        [tool.tox.env.lint]
        deps = [
          "ruff>=0.1",
          "mypy",
        ]
      `;
      const res = extractPackageFile(content, 'pyproject.toml');
      expect(res).toMatchObject({
        deps: [
          {
            currentValue: '>=4.2',
            datasource: 'pypi',
            depName: 'tox',
            depType: 'requires',
            packageName: 'tox',
          },
          {
            currentValue: '>=1.7',
            datasource: 'pypi',
            depName: 'tox-uv',
            depType: 'requires',
            packageName: 'tox-uv',
          },
          {
            currentValue: '>=7.2',
            datasource: 'pypi',
            depName: 'pytest',
            depType: 'env_run_base',
            packageName: 'pytest',
          },
          {
            currentValue: '>=7',
            datasource: 'pypi',
            depName: 'coverage',
            depType: 'env_run_base',
            packageName: 'coverage',
          },
          {
            currentValue: '>=0.1',
            datasource: 'pypi',
            depName: 'ruff',
            depType: 'env.lint',
            packageName: 'ruff',
          },
          {
            datasource: 'pypi',
            depName: 'mypy',
            depType: 'env.lint',
            packageName: 'mypy',
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('handles nested pyproject.toml path', () => {
      const content = codeBlock`
        [tool.tox]
        requires = ["tox>=4"]
      `;
      const res = extractPackageFile(content, 'packages/foo/pyproject.toml');
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].depName).toBe('tox');
    });

    it('extracts deps with extras from env_run_base', () => {
      const content = codeBlock`
        [env_run_base]
        deps = ["coverage[toml]>=7"]
      `;
      const res = extractPackageFile(content, 'tox.toml');
      expect(res?.deps[0]).toMatchObject({
        depName: 'coverage',
        packageName: 'coverage',
        currentValue: '>=7',
        datasource: 'pypi',
        depType: 'env_run_base',
      });
    });

    it('extracts pinned dep with currentVersion', () => {
      const content = codeBlock`
        requires = ["tox==4.5.0"]
      `;
      const res = extractPackageFile(content, 'tox.toml');
      expect(res?.deps[0]).toMatchObject({
        depName: 'tox',
        currentValue: '==4.5.0',
        currentVersion: '4.5.0',
        depType: 'requires',
      });
    });
  });
});
