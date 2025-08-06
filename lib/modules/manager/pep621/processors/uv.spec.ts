import { GoogleAuth as _googleAuth } from 'google-auth-library';
import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import type { RepoGlobalConfig } from '../../../../config/types';
import { getPkgReleases as _getPkgReleases } from '../../../datasource';
import { GitRefsDatasource } from '../../../datasource/git-refs';
import { GitTagsDatasource } from '../../../datasource/git-tags';
import { GithubTagsDatasource } from '../../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../../datasource/gitlab-tags';
import { PypiDatasource } from '../../../datasource/pypi';
import type { UpdateArtifactsConfig } from '../../types';
import { depTypes } from '../utils';
import { UvProcessor } from './uv';
import { mockExecAll } from '~test/exec-util';
import { fs, hostRules } from '~test/util';

vi.mock('google-auth-library');
vi.mock('../../../../util/fs');
vi.mock('../../../datasource');

const googleAuth = vi.mocked(_googleAuth);
const getPkgReleases = vi.mocked(_getPkgReleases);

const config: UpdateArtifactsConfig = {};
const adminConfig: RepoGlobalConfig = {
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
};

const processor = new UvProcessor();

describe('modules/manager/pep621/processors/uv', () => {
  describe('process()', () => {
    it('returns initial dependencies if there is no tool.uv section', () => {
      const pyproject = { tool: {} };
      const dependencies = [{ depName: 'dep1' }];

      const result = processor.process(pyproject, dependencies);

      expect(result).toEqual(dependencies);
    });

    it('includes uv dev dependencies if there is a tool.uv section', () => {
      const pyproject = {
        tool: { uv: { 'dev-dependencies': ['dep2==1.2.3', 'dep3==2.3.4'] } },
      };
      const dependencies = [{ depName: 'dep1' }];

      const result = processor.process(pyproject, dependencies);

      expect(result).toEqual([
        { depName: 'dep1' },
        {
          currentValue: '==1.2.3',
          currentVersion: '1.2.3',
          datasource: 'pypi',
          depName: 'dep2',
          depType: 'tool.uv.dev-dependencies',
          packageName: 'dep2',
        },
        {
          currentValue: '==2.3.4',
          currentVersion: '2.3.4',
          datasource: 'pypi',
          depName: 'dep3',
          depType: 'tool.uv.dev-dependencies',
          packageName: 'dep3',
        },
      ]);
    });
  });

  it('applies git sources', () => {
    const pyproject = {
      tool: {
        uv: {
          'dev-dependencies': ['dep3', 'dep4', 'dep5'],
          sources: {
            dep1: { git: 'https://github.com/foo/dep1', tag: '0.1.0' },
            dep2: { git: 'https://gitlab.com/foo/dep2', tag: '0.2.0' },
            dep3: { git: 'https://codeberg.org/foo/dep3.git', tag: '0.3.0' },
            dep4: {
              git: 'https://github.com/foo/dep4',
              rev: '1ca7d263f0f5038b53f74c5a757f18b8106c9390',
            },
            dep5: { git: 'https://github.com/foo/dep5', branch: 'master' },
          },
        },
      },
    };
    const dependencies = [
      {
        depName: 'dep1',
        packageName: 'dep1',
      },
      {
        depName: 'dep2',
        packageName: 'dep2',
      },
    ];

    const result = processor.process(pyproject, dependencies);

    expect(result).toEqual([
      {
        depName: 'dep1',
        depType: depTypes.uvSources,
        datasource: GithubTagsDatasource.id,
        registryUrls: ['https://github.com'],
        packageName: 'foo/dep1',
        currentValue: '0.1.0',
      },
      {
        depName: 'dep2',
        depType: depTypes.uvSources,
        datasource: GitlabTagsDatasource.id,
        registryUrls: ['https://gitlab.com'],
        packageName: 'foo/dep2',
        currentValue: '0.2.0',
      },
      {
        depName: 'dep3',
        depType: depTypes.uvSources,
        datasource: GitTagsDatasource.id,
        packageName: 'https://codeberg.org/foo/dep3.git',
        currentValue: '0.3.0',
      },
      {
        depName: 'dep4',
        depType: depTypes.uvSources,
        datasource: GitRefsDatasource.id,
        packageName: 'https://github.com/foo/dep4',
        currentDigest: '1ca7d263f0f5038b53f74c5a757f18b8106c9390',
        replaceString: '1ca7d263f0f5038b53f74c5a757f18b8106c9390',
      },
      {
        depName: 'dep5',
        depType: depTypes.uvSources,
        datasource: GitRefsDatasource.id,
        packageName: 'https://github.com/foo/dep5',
        currentValue: 'master',
        skipReason: 'git-dependency',
      },
    ]);
  });

  it('pinned to non-default index', () => {
    const pyproject = {
      tool: {
        uv: {
          sources: {
            dep1: { index: 'foo' },
            dep2: { index: 'bar' },
            dep3: { non_existent_future_source: {} } as any,
          },
          index: [
            {
              name: 'foo',
              url: 'https://foo.com/simple',
              default: false,
              explicit: true,
            },
            {
              name: 'bar',
              url: 'https://bar.com/simple',
              default: false,
              explicit: true,
            },
            {
              name: 'baz',
              url: 'https://baz.com/simple',
              default: false,
              explicit: false,
            },
          ],
        },
      },
    };

    const dependencies = [
      {
        depName: 'dep1',
        packageName: 'dep1',
      },
      {
        depName: 'dep2',
        packageName: 'dep2',
      },
      {
        depName: 'dep3',
        packageName: 'dep3',
      },
      {
        depName: 'dep4',
        packageName: 'dep4',
      },
    ];

    const result = processor.process(pyproject, dependencies);

    expect(result).toEqual([
      {
        depName: 'dep1',
        depType: depTypes.uvSources,
        registryUrls: ['https://foo.com/simple'],
        packageName: 'dep1',
      },
      {
        depName: 'dep2',
        depType: depTypes.uvSources,
        registryUrls: ['https://bar.com/simple'],
        packageName: 'dep2',
      },
      {
        depName: 'dep3',
        depType: depTypes.uvSources,
        packageName: 'dep3',
        skipReason: 'unknown-registry',
      },
      {
        depName: 'dep4',
        registryUrls: ['https://baz.com/simple', 'https://pypi.org/pypi/'],
        packageName: 'dep4',
      },
    ]);
  });

  it('index with optional name', () => {
    const pyproject = {
      tool: {
        uv: {
          index: [
            {
              url: 'https://foo.com/simple',
              default: true,
              explicit: false,
            },
          ],
        },
      },
    };

    const dependencies = [
      {
        depName: 'dep1',
        packageName: 'dep1',
      },
      {
        depName: 'dep2',
        packageName: 'dep2',
      },
    ];

    const result = processor.process(pyproject, dependencies);

    expect(result).toEqual([
      {
        depName: 'dep1',
        registryUrls: ['https://foo.com/simple'],
        packageName: 'dep1',
      },
      {
        depName: 'dep2',
        registryUrls: ['https://foo.com/simple'],
        packageName: 'dep2',
      },
    ]);
  });

  it('override implicit default index', () => {
    const pyproject = {
      tool: {
        uv: {
          index: [
            {
              name: 'foo',
              url: 'https://foo.com/simple',
              default: true,
              explicit: false,
            },
          ],
        },
      },
    };

    const dependencies = [
      {
        depName: 'python',
        packageName: 'python',
        depType: 'requires-python',
      },
      {
        depName: 'dep1',
        packageName: 'dep1',
      },
      {
        depName: 'dep2',
        packageName: 'dep2',
      },
    ];

    const result = processor.process(pyproject, dependencies);

    expect(result).toEqual([
      {
        depName: 'python',
        depType: 'requires-python',
        packageName: 'python',
      },
      {
        depName: 'dep1',
        registryUrls: ['https://foo.com/simple'],
        packageName: 'dep1',
      },
      {
        depName: 'dep2',
        registryUrls: ['https://foo.com/simple'],
        packageName: 'dep2',
      },
    ]);
  });

  it('override explicit default index', () => {
    const pyproject = {
      tool: {
        uv: {
          sources: {
            dep1: { index: 'foo' },
          },
          index: [
            {
              name: 'foo',
              url: 'https://foo.com/simple',
              default: true,
              explicit: true,
            },
          ],
        },
      },
    };

    const dependencies = [
      {
        depName: 'dep1',
        packageName: 'dep1',
      },
      {
        depName: 'dep2',
        packageName: 'dep2',
      },
    ];

    const result = processor.process(pyproject, dependencies);

    expect(result).toEqual([
      {
        depName: 'dep1',
        depType: depTypes.uvSources,
        registryUrls: ['https://foo.com/simple'],
        packageName: 'dep1',
      },
      {
        depName: 'dep2',
        registryUrls: [],
        packageName: 'dep2',
      },
    ]);
  });

  describe('updateArtifacts()', () => {
    it('returns null if there is no lock file', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('uv.lock');
      const updatedDeps = [{ packageName: 'dep1' }];
      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config,
          updatedDeps,
        },
        {},
      );
      expect(result).toBeNull();
    });

    it('returns null if the lock file is unchanged', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
      });
      fs.getSiblingFileName.mockReturnValueOnce('uv.lock');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      // python
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '3.11.1' }, { version: '3.11.2' }],
      });
      // uv
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '0.2.35' }, { version: '0.2.28' }],
      });

      const updatedDeps = [{ packageName: 'dep1' }];
      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: {},
          updatedDeps,
        },
        {
          project: {
            'requires-python': '==3.11.1',
          },
          tool: {
            uv: {
              'required-version': '==0.2.35',
            },
          },
        },
      );
      expect(result).toBeNull();
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'docker pull ghcr.io/containerbase/sidecar',
        },
        {
          cmd: 'docker ps --filter name=renovate_sidecar -aq',
        },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/cache":"/tmp/cache" ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/containerbase/sidecar ' +
            'bash -l -c "' +
            'install-tool python 3.11.1 ' +
            '&& ' +
            'install-tool uv 0.2.35 ' +
            '&& ' +
            'uv lock --upgrade-package dep1' +
            '"',
        },
      ]);
    });

    it('returns artifact error', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
      fs.getSiblingFileName.mockReturnValueOnce('uv.lock');
      fs.readLocalFile.mockImplementationOnce(() => {
        throw new Error('test error');
      });

      const updatedDeps = [{ packageName: 'dep1' }];
      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: {},
          updatedDeps,
        },
        {},
      );
      expect(result).toEqual([
        { artifactError: { lockFile: 'uv.lock', stderr: 'test error' } },
      ]);
      expect(execSnapshots).toEqual([]);
    });

    it('return update dep update', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);
      fs.getSiblingFileName.mockReturnValueOnce('uv.lock');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      fs.readLocalFile.mockResolvedValueOnce('changed test content');
      // python
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '3.11.1' }, { version: '3.11.2' }],
      });
      // uv
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '0.2.35' }, { version: '0.2.28' }],
      });

      const updatedDeps = [
        { packageName: 'dep1', depType: depTypes.dependencies },
        { packageName: 'dep2', depType: depTypes.dependencies },
        { depName: 'dep3', depType: depTypes.optionalDependencies },
        { depName: 'dep4', depType: depTypes.optionalDependencies },
        { depName: 'dep5', depType: depTypes.uvDevDependencies },
        { depName: 'dep6', depType: depTypes.uvDevDependencies },
        { depName: 'dep7', depType: depTypes.buildSystemRequires },
      ];
      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: {
            constraints: {},
          },
          updatedDeps,
        },
        {},
      );
      expect(result).toEqual([
        {
          file: {
            contents: 'changed test content',
            path: 'uv.lock',
            type: 'addition',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'uv lock --upgrade-package dep1 --upgrade-package dep2 --upgrade-package dep3 --upgrade-package dep4 --upgrade-package dep5 --upgrade-package dep6',
        },
      ]);
    });

    it('performs update on private package registry', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);
      hostRules.add({
        matchHost: 'https://example.com',
        username: 'user',
        password: 'pass',
      });
      hostRules.add({
        matchHost: 'https://pinned.com/simple',
        username: 'user',
        password: 'pass',
      });
      googleAuth.mockImplementationOnce(
        vi.fn().mockImplementationOnce(() => ({
          getAccessToken: vi.fn().mockResolvedValue('some-token'),
        })),
      );
      fs.getSiblingFileName.mockReturnValueOnce('uv.lock');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      fs.readLocalFile.mockResolvedValueOnce('changed test content');
      // python
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '3.11.1' }, { version: '3.11.2' }],
      });
      // uv
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '0.2.35' }, { version: '0.2.28' }],
      });

      const updatedDeps = [
        {
          packageName: 'dep1',
          depType: depTypes.dependencies,
          datasource: PypiDatasource.id,
          registryUrls: ['https://foobar.com'],
        },
        {
          packageName: 'dep2',
          depType: depTypes.dependencies,
          datasource: PypiDatasource.id,
          registryUrls: ['https://example.com'],
        },
        {
          packageName: 'dep3',
          depType: depTypes.dependencies,
          datasource: PypiDatasource.id,
          registryUrls: ['invalidurl'],
        },
        {
          packageName: 'dep4',
          depType: depTypes.dependencies,
          datasource: GithubTagsDatasource.id,
          registryUrls: ['https://github.com'],
        },
        {
          packageName: 'dep5',
          depType: depTypes.dependencies,
          datasource: PypiDatasource.id,
          registryUrls: [
            'https://someregion-python.pkg.dev/some-project/some-repo/',
          ],
        },
        {
          packageName: 'dep6',
          depType: depTypes.dependencies,
          datasource: PypiDatasource.id,
          registryUrls: ['https://pinned.com/simple'],
        },
        {
          packageName: 'dep7',
          depType: depTypes.dependencies,
          datasource: PypiDatasource.id,
          registryUrls: ['https://unnamed.com/simple'],
        },
      ];
      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: {},
          updatedDeps,
        },
        {
          tool: {
            uv: {
              sources: {
                dep6: { index: 'pinned-index' },
              },
              index: [
                {
                  name: 'pinned-index',
                  url: 'https://pinned.com/simple',
                  default: false,
                  explicit: true,
                },
                {
                  url: 'https://unnamed.com/simple',
                  default: false,
                  explicit: true,
                },
              ],
            },
          },
        },
      );
      expect(result).toEqual([
        {
          file: {
            contents: 'changed test content',
            path: 'uv.lock',
            type: 'addition',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'uv lock --upgrade-package dep1 --upgrade-package dep2 --upgrade-package dep3 --upgrade-package dep4 --upgrade-package dep5 --upgrade-package dep6 --upgrade-package dep7',
          options: {
            env: {
              GIT_CONFIG_COUNT: '6',
              GIT_CONFIG_KEY_0: 'url.https://user:pass@example.com/.insteadOf',
              GIT_CONFIG_KEY_1: 'url.https://user:pass@example.com/.insteadOf',
              GIT_CONFIG_KEY_2: 'url.https://user:pass@example.com/.insteadOf',
              GIT_CONFIG_VALUE_0: 'ssh://git@example.com/',
              GIT_CONFIG_VALUE_1: 'git@example.com:',
              GIT_CONFIG_VALUE_2: 'https://example.com/',
              UV_EXTRA_INDEX_URL:
                'https://foobar.com/ https://user:pass@example.com/ https://oauth2accesstoken:some-token@someregion-python.pkg.dev/some-project/some-repo/',
              UV_INDEX_PINNED_INDEX_USERNAME: 'user',
              UV_INDEX_PINNED_INDEX_PASSWORD: 'pass',
            },
          },
        },
      ]);
    });

    it('dont propagate uv.tool.index into UV_EXTRA_INDEX_URL', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);
      hostRules.add({
        matchHost: 'https://example.com',
        username: 'user',
        password: 'pass',
      });
      hostRules.add({
        matchHost: 'https://pinned.com/simple',
        username: 'user',
        password: 'pass',
      });
      hostRules.add({
        matchHost: 'https://implicit.com/simple',
        username: 'user',
        password: 'pass',
      });
      googleAuth.mockImplementation(
        vi.fn().mockImplementation(() => ({
          getAccessToken: vi.fn().mockResolvedValue(undefined),
        })),
      );
      fs.getSiblingFileName.mockReturnValueOnce('uv.lock');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      fs.readLocalFile.mockResolvedValueOnce('changed test content');
      // python
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '3.11.1' }, { version: '3.11.2' }],
      });
      // uv
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '0.2.35' }, { version: '0.2.28' }],
      });

      const updatedDeps = [
        {
          packageName: 'dep1',
          depType: depTypes.dependencies,
          datasource: PypiDatasource.id,
          registryUrls: ['https://example.com/simple'],
        },
        {
          packageName: 'dep2',
          depType: depTypes.dependencies,
          datasource: PypiDatasource.id,
          registryUrls: ['https://pinned.com/simple'],
        },
        {
          packageName: 'dep3',
          depType: depTypes.dependencies,
          datasource: PypiDatasource.id,
          registryUrls: [
            'https://implicit.com/simple',
            'https://pypi.org/pypi/',
          ],
        },
      ];
      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: {},
          updatedDeps,
        },
        {
          tool: {
            uv: {
              sources: {
                dep2: { index: 'pinned-index' },
              },
              index: [
                {
                  name: 'pinned-index',
                  url: 'https://pinned.com/simple',
                  default: false,
                  explicit: true,
                },
                {
                  name: 'implicit-index',
                  url: 'https://implicit.com/simple',
                  default: false,
                  explicit: false,
                },
              ],
            },
          },
        },
      );
      expect(result).toEqual([
        {
          file: {
            contents: 'changed test content',
            path: 'uv.lock',
            type: 'addition',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'uv lock --upgrade-package dep1 --upgrade-package dep2 --upgrade-package dep3',
          options: {
            env: {
              UV_EXTRA_INDEX_URL: 'https://user:pass@example.com/simple',
              UV_INDEX_PINNED_INDEX_USERNAME: 'user',
              UV_INDEX_PINNED_INDEX_PASSWORD: 'pass',
              UV_INDEX_IMPLICIT_INDEX_USERNAME: 'user',
              UV_INDEX_IMPLICIT_INDEX_PASSWORD: 'pass',
            },
          },
        },
      ]);
    });

    it('continues if Google auth is not configured', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);
      googleAuth.mockImplementation(
        vi.fn().mockImplementation(() => ({
          getAccessToken: vi.fn().mockResolvedValue(undefined),
        })),
      );
      fs.getSiblingFileName.mockReturnValueOnce('uv.lock');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      fs.readLocalFile.mockResolvedValueOnce('changed test content');
      // python
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '3.11.1' }, { version: '3.11.2' }],
      });
      // uv
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '0.2.35' }, { version: '0.2.28' }],
      });

      const updatedDeps = [
        {
          packageName: 'dep',
          depType: depTypes.dependencies,
          datasource: PypiDatasource.id,
          registryUrls: [
            'https://someregion-python.pkg.dev/some-project/some-repo/simple/',
          ],
        },
      ];
      const result = await processor.updateArtifacts(
        {
          packageFileName: 'pyproject.toml',
          newPackageFileContent: '',
          config: {},
          updatedDeps,
        },
        {},
      );
      expect(result).toEqual([
        {
          file: {
            contents: 'changed test content',
            path: 'uv.lock',
            type: 'addition',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'uv lock --upgrade-package dep',
          options: {
            env: {
              UV_EXTRA_INDEX_URL:
                'https://someregion-python.pkg.dev/some-project/some-repo/simple/',
            },
          },
        },
      ]);
    });

    it('return update on lockfileMaintenance', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);
      fs.getSiblingFileName.mockReturnValueOnce('uv.lock');
      fs.readLocalFile.mockResolvedValueOnce('test content');
      fs.readLocalFile.mockResolvedValueOnce('changed test content');
      // python
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '3.11.1' }, { version: '3.11.2' }],
      });
      // uv
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '0.2.35' }, { version: '0.2.28' }],
      });

      const result = await processor.updateArtifacts(
        {
          packageFileName: 'folder/pyproject.toml',
          newPackageFileContent: '',
          config: {
            isLockFileMaintenance: true,
          },
          updatedDeps: [],
        },
        {},
      );
      expect(result).toEqual([
        {
          file: {
            contents: 'changed test content',
            path: 'uv.lock',
            type: 'addition',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'uv lock --upgrade',
          options: {
            cwd: '/tmp/github/some/repo/folder',
          },
        },
      ]);
    });
  });
});
