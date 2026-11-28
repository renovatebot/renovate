import upath from 'upath';
import { mockExecAll } from '~test/exec-util.ts';
import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../../config/types.ts';
import * as docker from '../../../../util/exec/docker/index.ts';
import { getPkgReleases as _getPkgReleases } from '../../../datasource/index.ts';
import type { UpdateArtifactsConfig } from '../../types.ts';
import { parsePyProject } from '../extract.ts';
import { PixiProcessor } from './pixi.ts';

vi.mock('../../../../util/fs/index.ts');
vi.mock('../../../datasource/index.ts');

const getPkgReleases = vi.mocked(_getPkgReleases);

const config: UpdateArtifactsConfig = {};
const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
  allowedUnsafeExecutions: ['pixi'],
};

const processor = new PixiProcessor();

/**
 * Mocks `util/fs` with an in-memory repository. Reads of a `pixi.lock` after
 * the first return `<content> (relocked)`.
 */
function mockRepo(files: Record<string, string>): void {
  const reads = new Map<string, number>();
  function exists(path: string): boolean {
    return path in files;
  }
  fs.getParentDir.mockImplementation((path) => upath.parse(path).dir);
  fs.getSiblingFileName.mockImplementation((path, sibling) =>
    upath.join(upath.parse(path).dir, sibling),
  );
  fs.localPathExists.mockImplementation((path) =>
    Promise.resolve(exists(path)),
  );
  fs.findLocalSiblingOrParent.mockImplementation((path, other) => {
    let current = path;
    while (current !== '') {
      current = upath.parse(current).dir;
      const candidate = upath.join(current, other);
      if (exists(candidate)) {
        return Promise.resolve(candidate);
      }
    }
    return Promise.resolve(null);
  });
  fs.readLocalFile.mockImplementation((path: string) => {
    if (!exists(path)) {
      return Promise.resolve(null);
    }
    const count = (reads.get(path) ?? 0) + 1;
    reads.set(path, count);
    return Promise.resolve(
      path.endsWith('pixi.lock') && count > 1
        ? `${files[path]} (relocked)`
        : files[path],
    );
  });
  fs.ensureCacheDir.mockResolvedValue('/tmp/renovate/cache/others/pixi');
}

const subPackageToml = `
[project]
name = "diracx-routers"
dependencies = ["fastapi==0.110.0"]
`;

describe('modules/manager/pep621/processors/pixi', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
  });

  describe('process()', () => {
    it('returns deps unchanged', () => {
      const deps = [{ depName: 'dep1' }, { depName: 'dep2' }];

      const result = processor.process(parsePyProject('')!, deps);

      expect(result).toEqual(deps);
    });
  });

  describe('extractLockedVersions()', () => {
    it('returns deps unchanged', async () => {
      const deps = [{ depName: 'dep1' }, { depName: 'dep2' }];

      const result = await processor.extractLockedVersions(
        parsePyProject('')!,
        deps,
        'pyproject.toml',
      );

      expect(result).toEqual(deps);
    });
  });

  describe('getLockfiles()', () => {
    it('returns pixi.lock when found', async () => {
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('pixi.lock');
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');

      const result = await processor.getLockfiles(
        parsePyProject('')!,
        'pyproject.toml',
      );

      expect(result).toEqual(['pixi.lock']);
    });

    it('returns empty array when pixi.lock not found', async () => {
      fs.findLocalSiblingOrParent.mockResolvedValueOnce(null);

      const result = await processor.getLockfiles(
        parsePyProject('')!,
        'pyproject.toml',
      );

      expect(result).toEqual([]);
    });
  });

  // The exec flow, the `allowedUnsafeExecutions` gate, and the error handling
  // live in the shared `updatePixiLockfile` helper and are covered by
  // `../../pixi/lockfile.spec.ts`. These tests only assert the `pep621`
  // processor's own behavior: how it derives the `pixi` constraint and that it
  // delegates without writing the package file (the `pep621` manager writes it
  // elsewhere).
  describe('updateArtifacts()', () => {
    it('delegates to the shared helper without writing the package file', async () => {
      const execSnapshots = mockExecAll();
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('pixi.lock');
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config,
          updatedDeps: [{ depName: 'dep1' }],
        },
        parsePyProject('')!,
      );

      expect(result).toEqual([
        {
          file: {
            type: 'addition',
            path: 'pixi.lock',
            contents: 'New pixi.lock',
          },
        },
      ]);
      expect(fs.writeLocalFile).not.toHaveBeenCalled();
      expect(execSnapshots).toMatchObject([
        { cmd: 'pixi lock --no-progress --color=never --quiet' },
      ]);
    });

    it('derives the pixi constraint from requires-pixi in the pyproject', async () => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
      const execSnapshots = mockExecAll();
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('pixi.lock');
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '0.38.0' },
          { version: '0.40.1' },
          { version: '0.41.4' },
        ],
      });
      const project = parsePyProject(`
[tool.pixi.project]
name = "test"
channels = ["conda-forge"]
platforms = ["linux-64"]
requires-pixi = ">=0.40,<0.41"
`);

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: { constraints: {} },
          updatedDeps: [{ depName: 'dep1' }],
        },
        project!,
      );

      expect(result).toEqual([
        {
          file: {
            type: 'addition',
            path: 'pixi.lock',
            contents: 'New pixi.lock',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull ghcr.io/renovatebot/base-image' },
        { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/cache":"/tmp/cache" ' +
            '-e CI ' +
            '-e PIXI_CACHE_DIR ' +
            '-e RATTLER_CACHE_DIR ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/renovatebot/base-image ' +
            "bash -l -c '" +
            'install-tool pixi 0.40.1 ' +
            '&& ' +
            'pixi lock --no-progress --color=never --quiet' +
            "'",
        },
      ]);
    });

    it('prefers config.constraints.pixi over the pyproject requires-pixi', async () => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
      const execSnapshots = mockExecAll();
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('pixi.lock');
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '0.38.0' },
          { version: '0.40.1' },
          { version: '0.41.4' },
        ],
      });
      const project = parsePyProject(`
[tool.pixi.project]
name = "test"
channels = ["conda-forge"]
platforms = ["linux-64"]
requires-pixi = ">=0.38,<0.39"
`);

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: { constraints: { pixi: '>=0.40,<0.41' } },
          updatedDeps: [{ depName: 'dep1' }],
        },
        project!,
      );

      expect(result).toEqual([
        {
          file: {
            type: 'addition',
            path: 'pixi.lock',
            contents: 'New pixi.lock',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull ghcr.io/renovatebot/base-image' },
        { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/cache":"/tmp/cache" ' +
            '-e CI ' +
            '-e PIXI_CACHE_DIR ' +
            '-e RATTLER_CACHE_DIR ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/renovatebot/base-image ' +
            "bash -l -c '" +
            'install-tool pixi 0.40.1 ' +
            '&& ' +
            'pixi lock --no-progress --color=never --quiet' +
            "'",
        },
      ]);
    });

    it('falls back to the extracted pixi constraint', async () => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
      const execSnapshots = mockExecAll();
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('pixi.lock');
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '0.38.0' },
          { version: '0.40.1' },
          { version: '0.41.4' },
        ],
      });

      await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: {
            constraints: {},
            extractedConstraints: { pixi: '>=0.40,<0.41' },
          },
          updatedDeps: [{ depName: 'dep1' }],
        },
        parsePyProject('')!,
      );

      expect(execSnapshots.at(-1)?.cmd).toContain('install-tool pixi 0.40.1');
    });

    it('prefers the derived pixi constraint over the extracted one', async () => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
      const execSnapshots = mockExecAll();
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('pixi.lock');
      fs.getSiblingFileName.mockReturnValueOnce('pixi.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old pixi.lock');
      fs.ensureCacheDir.mockResolvedValueOnce(
        '/tmp/renovate/cache/others/pixi',
      );
      fs.readLocalFile.mockResolvedValueOnce('New pixi.lock');
      getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '0.38.0' },
          { version: '0.40.1' },
          { version: '0.41.4' },
        ],
      });
      const project = parsePyProject(`
[tool.pixi.project]
name = "test"
channels = ["conda-forge"]
platforms = ["linux-64"]
requires-pixi = ">=0.40,<0.41"
`);

      await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: {
            constraints: {},
            extractedConstraints: { pixi: '>=0.38,<0.39' },
          },
          updatedDeps: [{ depName: 'dep1' }],
        },
        project!,
      );

      expect(execSnapshots.at(-1)?.cmd).toContain('install-tool pixi 0.40.1');
    });
  });

  describe('pixi workspace members', () => {
    const lockFileContent = 'version: 6';

    it.each`
      table
      ${'pypi-dependencies'}
      ${'feature.routers.pypi-dependencies'}
      ${'target.linux-64.pypi-dependencies'}
      ${'feature.routers.target.linux-64.pypi-dependencies'}
    `(
      'relocks the parent pixi.lock when [$table] references the sub-package',
      async ({ table }) => {
        mockRepo({
          'pixi.toml': `
[workspace]
name = "diracx"
channels = ["conda-forge"]
platforms = ["linux-64"]

[${table}]
diracx-routers = { path = "diracx-routers", editable = true, extras = ["testing"] }
`,
          'pixi.lock': lockFileContent,
          'diracx-routers/pyproject.toml': subPackageToml,
        });
        const execSnapshots = mockExecAll();
        const project = parsePyProject(subPackageToml)!;

        const lockFiles = await processor.getLockfiles(
          project,
          'diracx-routers/pyproject.toml',
        );
        const result = await processor.updateArtifacts(
          {
            packageFileName: 'diracx-routers/pyproject.toml',
            newPackageFileContent: subPackageToml,
            config,
            updatedDeps: [{ depName: 'fastapi' }],
          },
          project,
        );

        expect(lockFiles).toEqual(['pixi.lock']);
        expect(result).toEqual([
          {
            file: {
              type: 'addition',
              path: 'pixi.lock',
              contents: `${lockFileContent} (relocked)`,
            },
          },
        ]);
        expect(execSnapshots).toMatchObject([
          {
            cmd: 'pixi lock --no-progress --color=never --quiet',
            options: { cwd: '/tmp/github/some/repo' },
          },
        ]);
      },
    );

    it('relocks a parent workspace defined in a root pyproject.toml', async () => {
      mockRepo({
        'pyproject.toml': `
[project]
name = "root"

[tool.pixi.workspace]
channels = ["conda-forge"]
platforms = ["linux-64"]

[tool.pixi.pypi-dependencies]
diracx-routers = { path = "./diracx-routers/", editable = true }
`,
        'pixi.lock': lockFileContent,
        'diracx-routers/pyproject.toml': subPackageToml,
      });
      const execSnapshots = mockExecAll();

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'diracx-routers/pyproject.toml',
          newPackageFileContent: subPackageToml,
          config,
          updatedDeps: [{ depName: 'fastapi' }],
        },
        parsePyProject(subPackageToml)!,
      );

      expect(result).toMatchObject([{ file: { path: 'pixi.lock' } }]);
      expect(execSnapshots).toHaveLength(1);
    });

    it('relocks a workspace further up that references the sub-package', async () => {
      mockRepo({
        'pixi.toml': `
[workspace]
channels = ["conda-forge"]
platforms = ["linux-64"]

[pypi-dependencies]
routers = { path = "packages/routers" }
`,
        'pixi.lock': lockFileContent,
        'packages/routers/pyproject.toml': subPackageToml,
      });
      const execSnapshots = mockExecAll();
      const project = parsePyProject(subPackageToml)!;

      await expect(
        processor.getLockfiles(project, 'packages/routers/pyproject.toml'),
      ).resolves.toEqual(['pixi.lock']);
      await expect(
        processor.updateArtifacts(
          {
            packageFileName: 'packages/routers/pyproject.toml',
            newPackageFileContent: subPackageToml,
            config,
            updatedDeps: [{ depName: 'fastapi' }],
          },
          project,
        ),
      ).resolves.toMatchObject([{ file: { path: 'pixi.lock' } }]);
      expect(execSnapshots).toHaveLength(1);
    });

    it.each`
      description                                     | manifest
      ${'references a different path'}                | ${'[pypi-dependencies]\nother = { path = "other" }'}
      ${'references a path with the same prefix'}     | ${'[pypi-dependencies]\nrouters = { path = "diracx-routers-extra" }'}
      ${'references the sub-package by version only'} | ${'[pypi-dependencies]\ndiracx-routers = ">=1"'}
      ${'has no pypi-dependencies'}                   | ${'[dependencies]\npython = "3.12.*"'}
      ${'is not valid TOML'}                          | ${'[pypi-dependencies'}
    `(
      'does not relock a parent workspace that $description',
      async ({ manifest }) => {
        mockRepo({
          'pixi.toml': `[workspace]\nchannels = ["conda-forge"]\nplatforms = ["linux-64"]\n\n${manifest}\n`,
          'pixi.lock': lockFileContent,
          'diracx-routers/pyproject.toml': subPackageToml,
        });
        const execSnapshots = mockExecAll();
        const project = parsePyProject(subPackageToml)!;

        const lockFiles = await processor.getLockfiles(
          project,
          'diracx-routers/pyproject.toml',
        );
        const result = await processor.updateArtifacts(
          {
            packageFileName: 'diracx-routers/pyproject.toml',
            newPackageFileContent: subPackageToml,
            config,
            updatedDeps: [{ depName: 'fastapi' }],
          },
          project,
        );

        expect(lockFiles).toEqual([]);
        expect(result).toBeNull();
        expect(execSnapshots).toEqual([]);
      },
    );

    it.each`
      description                                   | rootFiles
      ${'has a pyproject.toml without [tool.pixi]'} | ${{ 'pyproject.toml': '[project]\nname = "root"\n' }}
      ${'has no manifest'}                          | ${{}}
    `(
      'does not relock when the parent pixi.lock directory $description',
      async ({ rootFiles }) => {
        mockRepo({
          ...rootFiles,
          'pixi.lock': lockFileContent,
          'diracx-routers/pyproject.toml': subPackageToml,
        });
        const execSnapshots = mockExecAll();

        const result = await processor.updateArtifacts(
          {
            packageFileName: 'diracx-routers/pyproject.toml',
            newPackageFileContent: subPackageToml,
            config,
            updatedDeps: [{ depName: 'fastapi' }],
          },
          parsePyProject(subPackageToml)!,
        );

        expect(result).toBeNull();
        expect(execSnapshots).toEqual([]);
      },
    );

    it('only considers the nearest parent pixi.lock', async () => {
      mockRepo({
        'envs/dev/pixi.toml': `
[workspace]
channels = ["conda-forge"]
platforms = ["linux-64"]

[pypi-dependencies]
routers = { path = "../../diracx-routers" }
`,
        'envs/dev/pixi.lock': lockFileContent,
        'pixi.lock': lockFileContent,
        'diracx-routers/pyproject.toml': subPackageToml,
      });
      mockExecAll();

      // The nearest parent `pixi.lock` is the root one, which has no manifest.
      await expect(
        processor.getLockfiles(
          parsePyProject(subPackageToml)!,
          'diracx-routers/pyproject.toml',
        ),
      ).resolves.toEqual([]);
    });

    it('relocks a deeper workspace that references the sub-package with ../', async () => {
      mockRepo({
        'packages/pixi.toml': `
[workspace]
channels = ["conda-forge"]
platforms = ["linux-64"]

[pypi-dependencies]
routers = { path = "../packages/routers/" }
`,
        'packages/pixi.lock': lockFileContent,
        'packages/routers/pyproject.toml': subPackageToml,
      });
      const execSnapshots = mockExecAll();

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'packages/routers/pyproject.toml',
          newPackageFileContent: subPackageToml,
          config,
          updatedDeps: [{ depName: 'fastapi' }],
        },
        parsePyProject(subPackageToml)!,
      );

      expect(result).toMatchObject([{ file: { path: 'packages/pixi.lock' } }]);
      expect(execSnapshots).toMatchObject([
        { options: { cwd: '/tmp/github/some/repo/packages' } },
      ]);
    });

    it.each`
      table                    | manifest
      ${'workspace'}           | ${'pixi.toml'}
      ${'project'}             | ${'pixi.toml'}
      ${'tool.pixi.workspace'} | ${'pyproject.toml'}
    `(
      'uses requires-pixi from [$table] of the parent $manifest',
      async ({ table, manifest }) => {
        GlobalConfig.set({
          ...adminConfig,
          binarySource: 'docker',
          dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
        });
        const pypiTable =
          manifest === 'pixi.toml'
            ? 'pypi-dependencies'
            : 'tool.pixi.pypi-dependencies';
        mockRepo({
          [manifest]: `
[${table}]
channels = ["conda-forge"]
platforms = ["linux-64"]
requires-pixi = ">=0.40,<0.41"

[${pypiTable}]
diracx-routers = { path = "diracx-routers", editable = true }
`,
          'pixi.lock': lockFileContent,
          'diracx-routers/pyproject.toml': subPackageToml,
        });
        const execSnapshots = mockExecAll();
        getPkgReleases.mockResolvedValueOnce({
          releases: [
            { version: '0.38.0' },
            { version: '0.40.1' },
            { version: '0.41.4' },
          ],
        });

        await processor.updateArtifacts(
          {
            packageFileName: 'diracx-routers/pyproject.toml',
            newPackageFileContent: subPackageToml,
            config: { constraints: {} },
            updatedDeps: [{ depName: 'fastapi' }],
          },
          parsePyProject(subPackageToml)!,
        );

        expect(execSnapshots.at(-1)?.cmd).toContain('install-tool pixi 0.40.1');
      },
    );

    it('ignores requires-pixi of the sub-package for a parent workspace', async () => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
      const memberToml = `${subPackageToml}
[tool.pixi.workspace]
requires-pixi = ">=0.38,<0.39"
`;
      mockRepo({
        'pixi.toml': `
[workspace]
requires-pixi = ">=0.40,<0.41"

[pypi-dependencies]
diracx-routers = { path = "diracx-routers" }
`,
        'pixi.lock': lockFileContent,
        'diracx-routers/pyproject.toml': memberToml,
      });
      const execSnapshots = mockExecAll();
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '0.38.0' }, { version: '0.40.1' }],
      });

      await processor.updateArtifacts(
        {
          packageFileName: 'diracx-routers/pyproject.toml',
          newPackageFileContent: memberToml,
          config: { constraints: {} },
          updatedDeps: [{ depName: 'fastapi' }],
        },
        parsePyProject(memberToml)!,
      );

      expect(execSnapshots.at(-1)?.cmd).toContain('install-tool pixi 0.40.1');
    });

    it('leaves lock file maintenance of a parent workspace to the pixi manager', async () => {
      mockRepo({
        'pixi.toml': `
[workspace]
channels = ["conda-forge"]

[pypi-dependencies]
diracx-routers = { path = "diracx-routers" }
`,
        'pixi.lock': lockFileContent,
        'diracx-routers/pyproject.toml': subPackageToml,
      });
      const execSnapshots = mockExecAll();

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'diracx-routers/pyproject.toml',
          newPackageFileContent: subPackageToml,
          config: { isLockFileMaintenance: true },
          updatedDeps: [],
        },
        parsePyProject(subPackageToml)!,
      );

      expect(result).toBeNull();
      expect(fs.deleteLocalFile).not.toHaveBeenCalled();
      expect(execSnapshots).toEqual([]);
    });

    it('still runs lock file maintenance of a sibling pixi.lock', async () => {
      mockRepo({
        'pixi.lock': lockFileContent,
        'pyproject.toml': '[project]\nname = "root"\n',
      });
      const execSnapshots = mockExecAll();

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: { isLockFileMaintenance: true },
          updatedDeps: [],
        },
        parsePyProject('')!,
      );

      expect(result).toMatchObject([{ file: { path: 'pixi.lock' } }]);
      expect(fs.deleteLocalFile).toHaveBeenCalledWith('pixi.lock');
      expect(execSnapshots).toHaveLength(1);
    });

    it('still relocks a sibling pixi.lock without inspecting the workspace', async () => {
      mockRepo({
        'pixi.lock': lockFileContent,
        'pyproject.toml': '[project]\nname = "root"\n',
      });
      const execSnapshots = mockExecAll();

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config,
          updatedDeps: [{ depName: 'fastapi' }],
        },
        parsePyProject('')!,
      );

      expect(result).toMatchObject([{ file: { path: 'pixi.lock' } }]);
      expect(execSnapshots).toHaveLength(1);
    });
  });
});
