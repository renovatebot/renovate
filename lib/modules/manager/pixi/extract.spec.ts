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
requests = { version = '*'  }

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

const fullPixiConfig = `
[project]
authors = ["Trim21 <trim21.me@gmail.com>"]
channels = ["conda-forge", 'conda-not-forge']
name = "pixi"
platforms = ["win-64"]
version = "0.1.0"

[tasks]

[dependencies]
python = '==3.12'
numpy = { version = "*", build = "py312*" }

# scipy = { version = "==1.15.1", channel = "anaconda" }
[pypi-dependencies]
requests = '*'
requests2 = {version = '*'}

[target.win-64.pypi-dependencies]
urllib3 = {version = '*'}

[environments]
lint = { features = ['lint'] }
test = { features = ['test'] }
scipy = { features = ['scipy'] }

[feature.scipy]
channels = ["anaconda", {channel = 'cuda', priority = 1}]
dependencies = { scipy = { version = "==1.15.1", channel = "channel of scipy" } }
target.win-64 = { dependencies = { matplotlib = "==3.10.0" } }

[feature.lint.dependencies]
ruff = '==0.9.7'

[feature.lint.pypi-dependencies]
flake8 = '*'

[feature.lint.target.win-64.pypi-dependencies]
black = '==25.*'

[feature.test.pypi-dependencies]
black = '>0'
urllib3 = { url = "https://github.com/urllib3/urllib3/releases/download/2.3.0/urllib3-2.3.0-py3-none-any.whl" }
pytest = { git = "https://github.com/pytest-dev/pytest.git" }
requests = { git = "https://github.com/psf/requests.git", rev = "0106aced5faa299e6ede89d1230bd6784f2c3660" }

[feature.test.pypi-dependencies.pytest-github-actions-annotate-failures]
git = 'https://github.com/pytest-dev/pytest-github-actions-annotate-failures.git'
rev = "v0.3.0"
`;

const pixiChannelPriorityDisabled = `
[project]
channels = ["anaconda", "conda-forge"]
platforms = ["win-64"]
channel-priority = 'disabled'

[dependencies]
python = "3.12.*"
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
        deps: [
          {
            channels: ['conda-forge'],
            currentValue: '3.12.*',
            datasource: 'conda',
            depName: 'python',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge'],
            currentValue: '>=2.0,<3',
            datasource: 'conda',
            depName: 'geographiclib',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge'],
            currentValue: '>=2.4.1,<3',
            datasource: 'conda',
            depName: 'geopy',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge'],
            currentValue: '>=0.24.0,<0.25',
            datasource: 'conda',
            depName: 'cartopy',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge'],
            currentValue: '2.*',
            datasource: 'conda',
            depName: 'pydantic',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge'],
            currentValue: '>=3.10.0,<4',
            datasource: 'conda',
            depName: 'matplotlib',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge'],
            currentValue: '>=5.15.9,<6',
            datasource: 'conda',
            depName: 'pyqt',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge'],
            currentValue: '>=2.2.3,<3',
            datasource: 'conda',
            depName: 'pandas',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge'],
            currentValue: '>=2.9.0.post0,<3',
            datasource: 'conda',
            depName: 'python-dateutil',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge'],
            currentValue: '>=13.9.4,<14',
            datasource: 'conda',
            depName: 'rich',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge'],
            currentValue: '>=1.15.2,<2',
            datasource: 'conda',
            depName: 'scipy',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge'],
            currentValue: '>=4.67.1,<5',
            datasource: 'conda',
            depName: 'tqdm',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge'],
            currentValue: '>=2025a',
            datasource: 'conda',
            depName: 'tzdata',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge'],
            currentValue: '2.*',
            datasource: 'conda',
            depName: 'numpy',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge'],
            currentValue: '>=1.3.0,<2',
            datasource: 'conda',
            depName: 'adjusttext',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge'],
            currentValue: '>=3.11.1,<4',
            datasource: 'conda',
            depName: 'iris',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
        ],
        lockFiles: [],
      });
    });

    it('returns parse pixi section from pyproject.toml', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.localPathExists.mockResolvedValueOnce(true);

      expect(
        await extractPackageFile(pyprojectToml, 'pyproject.toml'),
      ).toMatchObject({
        deps: [
          {
            currentValue: '*',
            datasource: 'pypi',
            depName: 'requests',
            versioning: 'pep440',
          },
        ],
        lockFiles: ['pixi.lock'],
      });
    });

    it('returns package of pyproject.toml tool.pixi section', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.localPathExists.mockReturnValueOnce(Promise.resolve(false));

      expect(
        await extractPackageFile(pyprojectToml, 'pyproject.toml'),
      ).toMatchObject({
        deps: [
          {
            currentValue: '*',
            datasource: 'pypi',
            depName: 'requests',
            versioning: 'pep440',
          },
        ],
        lockFiles: [],
      });
    });

    it('returns parse pixi.toml with features', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.localPathExists.mockReturnValueOnce(Promise.resolve(false));

      expect(
        await extractPackageFile(fullPixiConfig, 'pixi.toml'),
      ).toMatchObject({
        deps: [
          {
            channels: ['conda-forge', 'conda-not-forge'],
            currentValue: '==3.12',
            datasource: 'conda',
            depName: 'python',
            registryUrls: [
              'https://api.anaconda.org/package/conda-forge/',
              'https://api.anaconda.org/package/conda-not-forge/',
            ],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge', 'conda-not-forge'],
            currentValue: '*',
            datasource: 'conda',
            depName: 'numpy',
            registryUrls: [
              'https://api.anaconda.org/package/conda-forge/',
              'https://api.anaconda.org/package/conda-not-forge/',
            ],
            versioning: 'conda',
          },
          {
            channel: 'channel of scipy',
            channels: ['cuda', 'anaconda', 'conda-forge', 'conda-not-forge'],
            currentValue: '==1.15.1',
            datasource: 'conda',
            depName: 'scipy',
            depType: 'feature-scipy',
            registryUrls: [
              'https://api.anaconda.org/package/channel of scipy/',
            ],
            versioning: 'conda',
          },
          {
            channels: ['cuda', 'anaconda', 'conda-forge', 'conda-not-forge'],
            currentValue: '==3.10.0',
            datasource: 'conda',
            depName: 'matplotlib',
            depType: 'feature-scipy',
            registryUrls: [
              'https://api.anaconda.org/package/cuda/',
              'https://api.anaconda.org/package/anaconda/',
              'https://api.anaconda.org/package/conda-forge/',
              'https://api.anaconda.org/package/conda-not-forge/',
            ],
            versioning: 'conda',
          },
          {
            channels: ['conda-forge', 'conda-not-forge'],
            currentValue: '==0.9.7',
            datasource: 'conda',
            depName: 'ruff',
            depType: 'feature-lint',
            registryUrls: [
              'https://api.anaconda.org/package/conda-forge/',
              'https://api.anaconda.org/package/conda-not-forge/',
            ],
            versioning: 'conda',
          },
          {
            currentValue: '*',
            datasource: 'pypi',
            depName: 'requests',
            versioning: 'pep440',
          },
          {
            currentValue: '*',
            datasource: 'pypi',
            depName: 'requests2',
            versioning: 'pep440',
          },
          {
            currentValue: '*',
            datasource: 'pypi',
            depName: 'urllib3',
            versioning: 'pep440',
          },
          {
            currentValue: '*',
            datasource: 'pypi',
            depName: 'flake8',
            depType: 'feature-lint',
            versioning: 'pep440',
          },
          {
            currentValue: '==25.*',
            datasource: 'pypi',
            depName: 'black',
            depType: 'feature-lint',
            versioning: 'pep440',
          },
          {
            currentValue: '>0',
            datasource: 'pypi',
            depName: 'black',
            depType: 'feature-test',
            versioning: 'pep440',
          },
          {
            currentValue: undefined,
            datasource: 'git-refs',
            depName: 'pytest',
            depType: 'feature-test',
            packageName: 'https://github.com/pytest-dev/pytest.git',
            skipReason: 'unspecified-version',
            skipStage: 'extract',
            versioning: 'git',
          },
          {
            currentValue: '0106aced5faa299e6ede89d1230bd6784f2c3660',
            datasource: 'git-refs',
            depName: 'requests',
            depType: 'feature-test',
            packageName: 'https://github.com/psf/requests.git',
            versioning: 'git',
          },
          {
            currentValue: 'v0.3.0',
            datasource: 'git-refs',
            depName: 'pytest-github-actions-annotate-failures',
            depType: 'feature-test',
            packageName:
              'https://github.com/pytest-dev/pytest-github-actions-annotate-failures.git',
            versioning: 'git',
          },
        ],
        lockFiles: [],
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
        deps: [
          {
            channels: ['conda-forge'],
            currentValue: '*',
            datasource: 'conda',
            depName: 'requests',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
        ],
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
        deps: [
          {
            channels: ['conda-forge'],
            currentValue: '*',
            datasource: 'conda',
            depName: 'requests',
            registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
            versioning: 'conda',
          },
        ],
        lockFiles: [],
      });
    });
  });

  it('extract feature with channels', async () => {
    await expect(
      extractPackageFile(
        codeBlock`
          [project]
          authors = ["Trim21 <trim21.me@gmail.com>"]
          channels = ["https://prefix.dev/conda-forge"]
          name = "pixi"
          platforms = ["win-64"]
          version = "0.1.0"

          [tasks]

          [dependencies]
          scipy = { version = "==1.15.1" }
          `,
        'pixi.toml',
      ),
    ).resolves.toMatchObject({
      deps: [
        {
          channels: ['https://prefix.dev/conda-forge'],
          currentValue: '==1.15.1',
          datasource: 'conda',
          depName: 'scipy',
          registryUrls: ['https://prefix.dev/conda-forge/'],
          versioning: 'conda',
        },
      ],
      lockFiles: [],
    });
  });

  it('skip package without channels', async () => {
    await expect(
      extractPackageFile(
        codeBlock`
            [project]
            name = "pixi"
            authors = []
            channels = []

            [tasks]

            [dependencies]
            scipy = { version = "==1.15.1" }
            `,
        'pixi.toml',
      ),
    ).resolves.toMatchObject({
      deps: [
        {
          datasource: 'conda',
          depName: 'scipy',
          skipReason: 'unknown-registry',
          skipStage: 'extract',
          versioning: 'conda',
        },
      ],
      lockFiles: [],
    });
  });

  it('extract package from with workspace', async () => {
    await expect(
      extractPackageFile(
        codeBlock`
            [workspace]
            channels = ["conda-forge"]


            [tasks]

            [dependencies]
            scipy = { version = "==1.15.1" }
            `,
        'pixi.toml',
      ),
    ).resolves.toMatchObject({
      deps: [
        {
          currentValue: '==1.15.1',
          datasource: 'conda',
          depName: 'scipy',
          registryUrls: ['https://api.anaconda.org/package/conda-forge/'],
          versioning: 'conda',
        },
      ],
      lockFiles: [],
    });
  });

  it(`extract package with channel priority`, async () => {
    const result = await extractPackageFile(
      codeBlock`
        [project]
        authors = ["Trim21 <trim21.me@gmail.com>"]
        channels = ["conda-forge", 'conda-not-forge']
        name = "pixi"
        platforms = ["win-64"]
        version = "0.1.0"

        [feature.scipy]
        channels = ["anaconda", {channel = 'cuda', priority = 1},  {channel = 'cuda2', priority = 1}]
        dependencies = { scipy = "==1.15.1" }

        [feature.numpy]
        dependencies = { numpy = "==1.15.1" }
        `,
      'pixi.toml',
    );

    expect(result).toMatchObject({
      deps: [
        {
          currentValue: '==1.15.1',
          datasource: 'conda',
          depName: 'scipy',
          registryUrls: [
            'https://api.anaconda.org/package/cuda/',
            'https://api.anaconda.org/package/cuda2/',
            'https://api.anaconda.org/package/anaconda/',
            'https://api.anaconda.org/package/conda-forge/',
            'https://api.anaconda.org/package/conda-not-forge/',
          ],
          versioning: 'conda',
        },
        {
          currentValue: '==1.15.1',
          datasource: 'conda',
          depName: 'numpy',
          depType: 'feature-numpy',
          registryUrls: [
            'https://api.anaconda.org/package/conda-forge/',
            'https://api.anaconda.org/package/conda-not-forge/',
          ],
          versioning: 'conda',
        },
      ],
      lockFiles: [],
    });
  });

  it('returns null for non-known config file', async () => {
    expect(await extractPackageFile(`{}`, 'unexpected.json')).toBe(null);
  });

  it(`set registryStrategy='merge' for channel-priority='disabled'"`, async () => {
    expect(
      await extractPackageFile(pixiChannelPriorityDisabled, 'pixi.toml'),
    ).toMatchObject({
      deps: [
        {
          channels: ['anaconda', 'conda-forge'],
          currentValue: '3.12.*',
          datasource: 'conda',
          depName: 'python',
          registryStrategy: 'merge',
          registryUrls: [
            'https://api.anaconda.org/package/anaconda/',
            'https://api.anaconda.org/package/conda-forge/',
          ],
          versioning: 'conda',
        },
      ],
      lockFiles: [],
    });
  });
  it(`use default registryStrategy for channel-priority='strict'"`, async () => {
    expect(
      await extractPackageFile(
        codeBlock`
        [project]
        channels = ["anaconda", "conda-forge"]
        platforms = ["win-64"]

        [dependencies]
        python = "3.12.*"
        `,
        'pixi.toml',
      ),
    ).toMatchObject({
      deps: [
        {
          channels: ['anaconda', 'conda-forge'],
          currentValue: '3.12.*',
          datasource: 'conda',
          depName: 'python',

          registryUrls: [
            'https://api.anaconda.org/package/anaconda/',
            'https://api.anaconda.org/package/conda-forge/',
          ],
          versioning: 'conda',
        },
      ],
      lockFiles: [],
    });
  });
});
