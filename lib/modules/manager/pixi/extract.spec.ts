import { codeBlock } from 'common-tags';
import { describe, expect, it, vi } from 'vitest';

import { extractPackageFile } from '.';
import { fs } from '~test/util';

vi.mock('../../../util/fs');

const pyprojectToml = `
[tool.pixi.project]
channels = ["conda-forge"]
platforms = ["osx-arm64"]

[tool.pixi.pypi-dependencies]
pixi_py = { path = ".", editable = true }

[tool.pixi.tasks]
`;

const pixiToml = `
[project]
authors = []
channels = ["conda-forge"]
name = "data"
platforms = ["win-64"]
version = "0.1.0"

[tasks]

[dependencies]
python = "3.12.*"
geographiclib = ">=2.0,<3"
geopy = ">=2.4.1,<3"
cartopy = ">=0.24.0,<0.25"
pydantic = "2.*"
matplotlib = ">=3.10.0,<4"
pyqt = ">=5.15.9,<6"
pandas = ">=2.2.3,<3"
python-dateutil = ">=2.9.0.post0,<3"
rich = ">=13.9.4,<14"
scipy = ">=1.15.2,<2"
tqdm = ">=4.67.1,<5"
tzdata = ">=2025a"
numpy = "2.*"
adjusttext = ">=1.3.0,<2"
iris = ">=3.11.1,<4"
`;

const pyprojectWithoutPixi = `
[project]
description = "non pixi managed project, should match nothing"
authors = [{ name = "ORGNAME", email = "orgname@orgname.org" }]
classifiers = ["Development Status :: 1 - Planning"]
dependencies = ["numpy"]
dynamic = ["version"]
license.file = "LICENSE"
name = "foo"
readme = "README.md"
requires-python = ">=3.10"

[project.optional-dependencies]
dev = ["pytest >=6", "pytest-cov >=3", "pre-commit"]
test = ["pytest >=6", "pytest-cov >=3", "mypy"]

[project.urls]
Homepage = "https://github.com/ORGNAME/foo"

[tool.setuptools_scm]
write_to = "src/foo/_version.py"

[tool.pytest.ini_options]
addopts = ["-ra", "--showlocals", "--strict-markers", "--strict-config"]
filterwarnings = ["error"]
log_cli_level = "INFO"
minversion = "6.0"
testpaths = ["tests"]
xfail_strict = true
`;

describe('modules/manager/pixi/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty pyproject.toml', async () => {
      expect(
        await extractPackageFile('nothing here', 'pyproject.toml'),
      ).toBeNull();
    });

    it('returns null for empty pixi.toml', async () => {
      expect(await extractPackageFile('nothing here', 'pixi.toml')).toBeNull();
    });

    it('returns null for parsed file without pixi section', async () => {
      expect(
        await extractPackageFile(pyprojectWithoutPixi, 'pyproject.toml'),
      ).toBeNull();
    });

    it('returns parse pixi.toml', async () => {
      expect(await extractPackageFile(pixiToml, 'pixi.toml')).toMatchObject({
        deps: [],
        lockFiles: [],
      });
    });

    it('returns parse pixi section from pyproject.toml', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.localPathExists.mockResolvedValueOnce(true);

      expect(
        await extractPackageFile(pyprojectToml, 'pyproject.toml'),
      ).toMatchObject({
        deps: [],
        lockFiles: ['pixi.lock'],
      });
    });

    it('returns parse non-known config file as pyproject.toml', async () => {
      expect(
        await extractPackageFile(
          codeBlock`
          [tool.pixi.project]
          channels = ['conda-forge']
          platforms = ["osx-arm64"]

          [tool.pixi.dependencies]
          requests = '*'
          `,
          'not-sure-what-file-this-is.toml',
        ),
      ).toMatchObject({
        deps: [],
        lockFiles: [],
      });
    });

    it('returns parse non-known config file as pixi.toml', async () => {
      expect(
        await extractPackageFile(
          codeBlock`
        [project]
        channels = ['conda-forge']
        platforms = ["osx-arm64"]

        [dependencies]
        requests = '*'
        `,
          'not-sure-what-file-this-is.toml',
        ),
      ).toMatchObject({
        deps: [],
        lockFiles: [],
      });
    });

    it('returns null for non-known config file', async () => {
      expect(await extractPackageFile(`{}`, 'unexpected.json')).toBe(null);
    });
  });
});
