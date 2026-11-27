import { generateKeyPair } from 'node:crypto';
import dns from 'node:dns/promises';
import { access, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { isString } from '@sindresorhus/is';
import tmp from 'tmp-promise';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { envMock, exec, mockExecAll } from '~test/exec-util.ts';
import { hostRules } from '~test/host-rules.ts';
import { env, fs, logger } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import type { ConstraintName } from '../../../util/exec/types.ts';
import * as hexRepository from '../../../util/hex-repository.ts';
import { getPkgReleases as _getPkgReleases } from '../../datasource/index.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { updateArtifacts } from './index.ts';

vi.mock('../../../util/exec/env.ts');
vi.mock('../../../util/fs/index.ts');
vi.mock('../../datasource/index.ts', () => mockDeep());

const getPkgReleases = vi.mocked(_getPkgReleases);

const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
  binarySource: 'global',
};

// support install mode
process.env.CONTAINERBASE = 'true';

const config: UpdateArtifactsConfig = {};
const constraints: Partial<Record<ConstraintName, string>> = {
  erlang: '25.0.0.0',
  elixir: 'v1.13.4',
};

function mockDnsAddress(address: string): void {
  // Vitest takes the single-address overload; preflight asks for every address.
  vi.spyOn(dns, 'lookup').mockResolvedValue([{ address, family: 4 }] as never);
}

describe('modules/manager/mix/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  describe('named Hex repositories', () => {
    const url = 'https://repo.example.com/hex';
    const repository = {
      url,
      publicKeyFingerprint:
        'SHA256:4/OSKi0NRF91QVVXlGAhb/BIMLnK8NHcx/EWs+aIWPc',
    };
    const hexRepositories = { company: repository };

    beforeEach(async () => {
      const cache = await tmp.dir({ unsafeCleanup: true });
      const realFs = await vi.importActual<
        typeof import('../../../util/fs/index.ts')
      >('../../../util/fs/index.ts');
      GlobalConfig.set({ ...adminConfig, cacheDir: cache.path });
      fs.privateCacheDir.mockImplementation(realFs.privateCacheDir);
      fs.ensureDir.mockImplementation(realFs.ensureDir);
      fs.outputCacheFile.mockImplementation(realFs.outputCacheFile);
      mockDnsAddress('93.184.216.34');
      return cache.cleanup;
    });

    it.each`
      authType        | authorization
      ${'Token-Only'} | ${'literal-token'}
      ${'Bearer'}     | ${'Bearer literal-token'}
      ${undefined}    | ${undefined}
    `(
      'stages verified keys and effective authorization for the entire solve ($authType)',
      async ({ authType, authorization }) => {
        fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
        fs.readLocalFile
          .mockResolvedValueOnce('Old mix.lock')
          .mockResolvedValueOnce('New mix.lock');
        if (authType) {
          hostRules.add({
            hostType: 'hex',
            matchHost: `${url}/`,
            token: 'literal-token',
            authType,
          });
        }
        const resolve = vi
          .spyOn(hexRepository, 'resolveHexPublicKey')
          .mockResolvedValue('verified key');
        let hexHome: string | undefined;
        let stagedKey: string | undefined;
        let stagedAuth: string | undefined;
        const execResult = { stdout: '', stderr: '' };
        exec
          .mockImplementationOnce(async (_cmd, opts) => {
            hexHome = opts.env?.HEX_HOME;
            stagedKey = await readFile(join(hexHome!, 'company.pem'), 'utf8');
            stagedAuth = await readFile(
              join(hexHome!, 'company.auth'),
              'utf8',
            ).catch(() => undefined);
            return execResult;
          })
          .mockResolvedValue(execResult);

        const result = await updateArtifacts({
          packageFileName: 'mix.exs',
          updatedDeps: [],
          newPackageFileContent: '{}',
          config: { hexRepositories, isLockFileMaintenance: true },
        });

        expect(result).toEqual([
          {
            file: {
              type: 'addition',
              path: 'mix.lock',
              contents: 'New mix.lock',
            },
          },
        ]);
        expect(resolve).toHaveBeenCalledExactlyOnceWith('company', repository);
        expect(exec).toHaveBeenCalledTimes(2);
        const [[register, opts], [solve]] = exec.mock.calls;
        expect(register).toContain(
          `mix hex.repo add company ${url} --public-key`,
        );
        expect(isString(register) && register.includes('--auth-key')).toBe(
          authorization !== undefined,
        );
        expect(JSON.stringify(exec.mock.calls)).not.toContain('literal-token');
        expect(opts.env).toMatchObject({
          HEX_UNSAFE_REGISTRY: '0',
          HEX_NO_VERIFY_REPO_ORIGIN: '0',
        });
        expect(solve).toBe('mix deps.get');
        expect(stagedKey).toBe('verified key');
        expect(stagedAuth).toBe(authorization);
        await expect(access(hexHome!)).rejects.toThrow('ENOENT');
      },
    );

    it.each([url, `${url}/packages/blocked_package`])(
      'fails before fetching the key or starting Mix when %s is disabled',
      async (matchHost) => {
        fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
        fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
        hostRules.add({ hostType: 'hex', matchHost, enabled: false });
        const resolve = vi.spyOn(hexRepository, 'resolveHexPublicKey');

        const result = await updateArtifacts({
          packageFileName: 'mix.exs',
          updatedDeps: [{ depName: 'public_dep' }],
          newPackageFileContent: '{}',
          config: { hexRepositories },
        });

        expect(result).toMatchObject([
          { artifactError: { fileName: 'mix.lock', stderr: 'host-disabled' } },
        ]);
        expect(resolve).not.toHaveBeenCalled();
        expect(exec).not.toHaveBeenCalled();
      },
    );

    it('blocks a registry hostname that resolves to a private address', async () => {
      GlobalConfig.set({ ...GlobalConfig.get(), internalHostAccess: 'block' });
      mockDnsAddress('10.0.0.2');
      fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');

      const result = await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'company_dep' }],
        newPackageFileContent: '{}',
        config: { hexRepositories },
      });

      expect(result).toMatchObject([
        { artifactError: { fileName: 'mix.lock', stderr: 'host-blocked' } },
      ]);
      expect(exec).not.toHaveBeenCalled();
    });

    it('honors an internal-host veto scoped to registry packages', async () => {
      GlobalConfig.set({ ...GlobalConfig.get(), internalHostAccess: 'block' });
      mockDnsAddress('10.0.0.2');
      hostRules.add(
        { hostType: 'hex', matchHost: url, allowInternal: true },
        { trusted: true },
      );
      hostRules.add(
        {
          hostType: 'hex',
          matchHost: `${url}/packages/`,
          allowInternal: false,
        },
        { trusted: true },
      );
      fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');

      const result = await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'company_dep' }],
        newPackageFileContent: '{}',
        config: { hexRepositories },
      });

      expect(result).toMatchObject([
        { artifactError: { fileName: 'mix.lock', stderr: 'host-blocked' } },
      ]);
      expect(exec).not.toHaveBeenCalled();
    });

    it('fails before Mix when Docker has a different nonroot UID', async () => {
      GlobalConfig.set({
        ...GlobalConfig.get(),
        binarySource: 'docker',
        dockerUser: `${(process.getuid?.() ?? 0) + 1}:12021`,
      });
      fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');

      const result = await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'company_dep' }],
        newPackageFileContent: '{}',
        config: { hexRepositories },
      });

      expect(result).toMatchObject([
        {
          artifactError: {
            fileName: 'mix.lock',
            stderr: expect.stringContaining('require dockerUser'),
          },
        },
      ]);
      expect(exec).not.toHaveBeenCalled();
    });

    it('leaves ordinary artifact calls without updates as no-ops for private projects', async () => {
      const result = await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { hexRepositories },
      });

      expect(result).toBeNull();
      expect(fs.writeLocalFile).not.toHaveBeenCalled();
      expect(exec).not.toHaveBeenCalled();
    });

    it('cleans the private home on failure and restores a maintenance lockfile for retry', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
      fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
      vi.spyOn(hexRepository, 'resolveHexPublicKey').mockResolvedValue(
        'verified key',
      );
      const calls = mockExecAll(new Error('Hex setup failed'));

      const result = await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { hexRepositories, isLockFileMaintenance: true },
      });

      expect(result).toMatchObject([
        { artifactError: { fileName: 'mix.lock', stderr: 'Hex setup failed' } },
      ]);
      expect(fs.writeLocalFile).toHaveBeenCalledWith(
        'mix.lock',
        'Old mix.lock',
      );
      await expect(access(calls[0].options!.env!.HEX_HOME!)).rejects.toThrow(
        'ENOENT',
      );
    });

    it('stages an Artifactory PEM and Bearer token inside the Docker cache mount for an umbrella solve', async () => {
      const cacheDir = GlobalConfig.get('cacheDir');
      GlobalConfig.set({
        ...adminConfig,
        cacheDir,
        binarySource: 'docker',
        dockerUser: String(process.getuid?.() ?? 0),
        allowedHeaders: ['Authorization'],
      });
      const { publicKey } = await promisify(generateKeyPair)('rsa', {
        modulusLength: 2048,
      });
      const pem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
      const artifactoryUrl =
        'https://repo.example.com/artifactory/api/hex/team-hex';
      hostRules.add({
        hostType: 'hex',
        matchHost: artifactoryUrl,
        token: 'fallback-token',
        headers: { Authorization: 'Bearer artifactory-token' },
      });
      fs.getSiblingFileName.mockReturnValueOnce('apps/child/mix.lock');
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('mix.lock');
      fs.readLocalFile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('Old mix.lock')
        .mockResolvedValueOnce('New mix.lock');
      let stagedKey: string | undefined;
      let stagedAuth: string | undefined;
      let authMode: number | undefined;
      exec.mockImplementation(async (cmd, opts) => {
        if (isString(cmd) && cmd.startsWith('docker run')) {
          stagedKey = await readFile(
            join(opts.env!.HEX_HOME!, 'team-hex.pem'),
            'utf8',
          );
          stagedAuth = await readFile(
            join(opts.env!.HEX_HOME!, 'team-hex.auth'),
            'utf8',
          );
          authMode =
            (await stat(join(opts.env!.HEX_HOME!, 'team-hex.auth'))).mode &
            0o777;
        }
        return { stdout: '', stderr: '' };
      });

      const result = await updateArtifacts({
        packageFileName: 'apps/child/mix.exs',
        updatedDeps: [{ depName: 'private_package' }],
        newPackageFileContent: '{}',
        config: {
          constraints: { erlang: '26.0.0', elixir: '1.14.5' },
          hexRepositories: {
            'team-hex': { url: artifactoryUrl, publicKey: pem },
          },
        },
      });

      const [dockerRun, opts] = exec.mock.calls.find(
        ([cmd]) => isString(cmd) && cmd.startsWith('docker run'),
      )!;
      expect(result).toEqual([
        {
          file: {
            type: 'addition',
            path: 'mix.lock',
            contents: 'New mix.lock',
          },
        },
      ]);
      expect(dockerRun).toContain(`-v "${cacheDir}":"${cacheDir}"`);
      expect(dockerRun).toContain('-e HEX_HOME');
      expect(dockerRun).toContain(
        `mix hex.repo add team-hex ${artifactoryUrl} --public-key`,
      );
      expect(dockerRun).toContain('&& mix deps.update private_package');
      expect(dockerRun).not.toContain('artifactory-token');
      expect(stagedKey).toBe(pem);
      expect(stagedAuth).toBe('Bearer artifactory-token');
      expect(opts.env!.HEX_HOME).toContain('__renovate-private-cache');
      // Windows does not expose POSIX permission bits.
      expect(process.platform === 'win32' || authMode === 0o600).toBeTrue();
      expect(opts.cwd).toBe(adminConfig.localDir);
      await expect(access(opts.env!.HEX_HOME!)).rejects.toThrow('ENOENT');
    });
  });

  it('returns null if no mix.lock found', async () => {
    await expect(
      updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '',
        config,
      }),
    ).resolves.toBeNull();
  });

  it('returns null if no updatedDeps were provided', async () => {
    await expect(
      updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      }),
    ).resolves.toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    await expect(
      updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '',
        config,
      }),
    ).resolves.toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current mix.lock');
    const execSnapshots = mockExecAll();
    await expect(
      updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '',
        config,
      }),
    ).resolves.toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'mix deps.update plug',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('returns null when trying to use lockFileMaintenance with no mix.lock file', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.localPathExists.mockResolvedValueOnce(false);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce(null);

    fs.writeLocalFile.mockClear(); // Clear the mock to ensure we can check if it's called

    await expect(
      updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...config, isLockFileMaintenance: true },
      }),
    ).resolves.toBeNull();

    expect(fs.writeLocalFile).not.toHaveBeenCalled();
  });

  it('returns null if no updatedDeps and no lockFileMaintenance', async () => {
    await expect(
      updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      }),
    ).resolves.toBeNull();
  });

  it('returns null if using lockFileMaintenance in umbrella project', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('apps/foo/mix.lock');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');
    await expect(
      updateArtifacts({
        packageFileName: 'apps/foo/mix.exs',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...config, isLockFileMaintenance: true },
      }),
    ).resolves.toBeNull();
    expect(logger.logger.debug).toHaveBeenCalledWith(
      'Cannot use lockFileMaintenance in an umbrella project, see https://docs.renovatebot.com/modules/manager/mix/#lockFileMaintenance',
    );
  });

  it('uses productLinks.documentation in lockFileMaintenance umbrella log URL', async () => {
    GlobalConfig.set({
      ...adminConfig,
      productLinks: { documentation: 'https://custom.example.com/' },
    });
    fs.getSiblingFileName.mockReturnValueOnce('apps/foo/mix.lock');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');
    await expect(
      updateArtifacts({
        packageFileName: 'apps/foo/mix.exs',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...config, isLockFileMaintenance: true },
      }),
    ).resolves.toBeNull();
    expect(logger.logger.debug).toHaveBeenCalledWith(
      'Cannot use lockFileMaintenance in an umbrella project, see https://custom.example.com/modules/manager/mix/#lockFileMaintenance',
    );
  });

  it('returns updated mix.lock', async () => {
    GlobalConfig.set({
      ...adminConfig,
      binarySource: 'docker',
      dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
    });
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');

    // erlang
    getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: '24.3.4.1' },
        { version: '25.0.0.0' },
        { version: '27.3.4.3' },
      ],
    });
    // elixir
    getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: 'v1.8.2' },
        { version: 'v1.13.3' },
        { version: 'v1.13.4' },
      ],
    });

    await expect(
      updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config,
      }),
    ).resolves.toEqual([
      {
        file: { type: 'addition', path: 'mix.lock', contents: 'New mix.lock' },
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
          '-e CI -e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/renovatebot/base-image ' +
          "bash -l -c 'install-tool erlang 27.3.4.3 && install-tool elixir v1.13.4 && mix deps.update plug'",
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('uses constraints on install mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');

    await expect(
      updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config: {
          ...config,
          constraints: { erlang: '26.0.0', elixir: '1.14.5' },
        },
      }),
    ).resolves.toEqual([
      {
        file: { type: 'addition', path: 'mix.lock', contents: 'New mix.lock' },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool erlang 26.0.0' },
      { cmd: 'install-tool elixir 1.14.5' },
      { cmd: 'mix deps.update plug' },
    ]);
  });

  it('falls back to the extracted erlang and elixir constraints', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');

    // erlang
    getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '24.3.4.1' }, { version: '26.2.5.4' }],
    });

    await updateArtifacts({
      packageFileName: 'mix.exs',
      updatedDeps: [{ depName: 'plug' }],
      newPackageFileContent: '{}',
      config: {
        ...config,
        extractedConstraints: { erlang: '24.3.4.1', elixir: '1.14.5' },
      },
    });

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool erlang 24.3.4.1' },
      { cmd: 'install-tool elixir 1.14.5' },
      { cmd: 'mix deps.update plug' },
    ]);
  });

  describe('erlang constraint from the elixir constraint', () => {
    beforeEach(() => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
      fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
      fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
      fs.readLocalFile.mockResolvedValueOnce('New mix.lock');
      getPkgReleases.mockImplementation(({ packageName }) => {
        const versions =
          packageName === 'elixir-lang/elixir'
            ? ['v1.10.4', 'v1.13.4', 'v1.15.8', 'v1.18.4', 'v1.20.5']
            : [
                '24.3.4.17',
                '25.3.2.21',
                '26.2.5.4',
                '27.3.4.3',
                '28.3.1.0',
                '29.1.2.0',
              ];
        return Promise.resolve({
          releases: versions.map((version) => ({ version })),
        });
      });
    });

    it.each`
      constraint              | erlang         | elixir
      ${undefined}            | ${'29.1.2.0'}  | ${'v1.20.5'}
      ${'>=1.13.0 <2.0.0-0'}  | ${'29.1.2.0'}  | ${'v1.20.5'}
      ${'>=1.15.0 <1.16.0-0'} | ${'26.2.5.4'}  | ${'v1.15.8'}
      ${'1.18.4'}             | ${'27.3.4.3'}  | ${'1.18.4'}
      ${'1.14.5'}             | ${'25.3.2.21'} | ${'1.14.5'}
      ${'>=1.10.0 <1.11.0-0'} | ${'24.3.4.17'} | ${'v1.10.4'}
      ${'>=1.10.0 <1.10.4.1'} | ${'29.1.2.0'}  | ${'v1.10.4'}
    `(
      'installs erlang $erlang and elixir $elixir for elixir constraint $constraint',
      async ({
        constraint,
        erlang,
        elixir,
      }: {
        constraint: string | undefined;
        erlang: string;
        elixir: string;
      }) => {
        const execSnapshots = mockExecAll();

        await updateArtifacts({
          packageFileName: 'mix.exs',
          updatedDeps: [{ depName: 'plug' }],
          newPackageFileContent: '{}',
          config: { ...config, extractedConstraints: { elixir: constraint } },
        });

        expect(execSnapshots).toMatchObject([
          { cmd: `install-tool erlang ${erlang}` },
          { cmd: `install-tool elixir ${elixir}` },
          { cmd: 'mix deps.update plug' },
        ]);
      },
    );

    it('prefers the configured elixir constraint over the extracted one', async () => {
      const execSnapshots = mockExecAll();

      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config: {
          ...config,
          constraints: { elixir: '1.15.8' },
          extractedConstraints: { elixir: '>=1.18.0 <2.0.0-0' },
        },
      });

      expect(execSnapshots).toMatchObject([
        { cmd: 'install-tool erlang 26.2.5.4' },
        { cmd: 'install-tool elixir 1.15.8' },
        { cmd: 'mix deps.update plug' },
      ]);
    });

    it('keeps the configured erlang constraint', async () => {
      const execSnapshots = mockExecAll();

      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config: {
          ...config,
          constraints: { erlang: '25' },
          extractedConstraints: { elixir: '>=1.18.0 <2.0.0-0' },
        },
      });

      expect(execSnapshots).toMatchObject([
        { cmd: 'install-tool erlang 25.3.2.21' },
        { cmd: 'install-tool elixir v1.20.5' },
        { cmd: 'mix deps.update plug' },
      ]);
    });
  });

  it('authenticates to private repositories in updated dependencies', async () => {
    GlobalConfig.set({
      ...adminConfig,
      binarySource: 'docker',
      dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
    });
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');
    hostRules.add({
      matchHost: 'https://hex.pm/api/repos/renovate_test/',
      token: 'valid_test_token',
    });

    // erlang
    getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: '24.3.4.1' },
        { version: '25.0.0.0' },
        { version: '27.3.4.3' },
      ],
    });
    // elixir
    getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: 'v1.8.2' },
        { version: 'v1.13.3' },
        { version: 'v1.13.4' },
      ],
    });

    const result = await updateArtifacts({
      packageFileName: 'mix.exs',
      updatedDeps: [
        {
          depName: 'private_package',
          packageName: 'private_package:renovate_test',
        },
        {
          depName: 'other_package',
          packageName: 'other_package:unauthorized_organization',
        },
      ],
      newPackageFileContent: '{}',
      config,
    });

    expect(result).toEqual([
      {
        file: { type: 'addition', path: 'mix.lock', contents: 'New mix.lock' },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/cache":"/tmp/cache" ' +
          '-e CI -e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/renovatebot/base-image ' +
          "bash -l -c 'install-tool erlang 27.3.4.3 && install-tool elixir v1.13.4 && " +
          'mix hex.organization auth renovate_test --key valid_test_token && ' +
          "mix deps.update private_package other_package'",
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('authenticates to private repositories configured in hostRules', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');
    hostRules.add({
      matchHost: 'https://hex.pm/api/repos/an_organization/',
      token: 'an_organization_token',
    });
    // unauthorized_organization token missing
    hostRules.add({
      matchHost: 'https://hex.pm/api/repos/unauthorized_organization/',
    });
    hostRules.add({
      matchHost: 'https://hex.pm/api/repos/other_organization/',
      token: 'other_org_token',
    });
    hostRules.add({
      matchHost: 'https://hex.pm/api/repos/does_not_match_org/packages/',
      token: 'does_not_match_org_token',
    });
    hostRules.add({
      matchHost: 'https://example.com/api/repos/also_does_not_match_org/',
    });
    hostRules.add({ matchHost: 'hex.pm' });

    // erlang
    getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: '24.3.4.1' },
        { version: '25.0.0.0' },
        { version: '27.3.4.3' },
      ],
    });
    // elixir
    getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: 'v1.8.2' },
        { version: 'v1.13.3' },
        { version: 'v1.13.4' },
      ],
    });

    const result = await updateArtifacts({
      packageFileName: 'mix.exs',
      updatedDeps: [{ depName: 'some_package' }],
      newPackageFileContent: '{}',
      config,
    });

    expect(result).toEqual([
      {
        file: { type: 'addition', path: 'mix.lock', contents: 'New mix.lock' },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool erlang 27.3.4.3' },
      { cmd: 'install-tool elixir v1.13.4' },
      {
        cmd: 'mix hex.organization auth an_organization --key an_organization_token',
      },
      {
        cmd: 'mix hex.organization auth other_organization --key other_org_token',
      },
      { cmd: 'mix deps.update some_package' },
    ]);
  });

  it('quotes an organization value containing shell metacharacters', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');
    // a broad host rule matching all of hex.pm, as opposed to one scoped to
    // a specific organization's repo URL
    hostRules.add({ matchHost: 'hex.pm', token: 'secret_token' });

    // erlang
    getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '27.3.4.3' }],
    });
    // elixir
    getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: 'v1.13.4' }],
    });

    await updateArtifacts({
      packageFileName: 'mix.exs',
      updatedDeps: [
        {
          depName: 'private_package',
          // organization value as it would be parsed from an attacker-controlled
          // `organization: "..."` field in mix.exs
          packageName: 'private_package:evil --key leaked_or_arbitrary',
        },
      ],
      newPackageFileContent: '{}',
      config,
    });

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool erlang 27.3.4.3' },
      { cmd: 'install-tool elixir v1.13.4' },
      {
        cmd: "mix hex.organization auth 'evil --key leaked_or_arbitrary' --key secret_token",
      },
      { cmd: 'mix deps.update private_package' },
    ]);
  });

  it('returns updated mix.lock in subdir', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.getSiblingFileName.mockReturnValueOnce('subdir/mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');

    const execSnapshots = mockExecAll();
    await expect(
      updateArtifacts({
        packageFileName: 'subdir/mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config: { ...config, constraints },
      }),
    ).resolves.toEqual([
      {
        file: {
          path: 'subdir/mix.lock',
          type: 'addition',
          contents: 'New mix.lock',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool erlang 25.0.0.0' },
      { cmd: 'install-tool elixir v1.13.4' },
      {
        cmd: 'mix deps.update plug',
        options: { cwd: '/tmp/github/some/repo/subdir' },
      },
    ]);
  });

  it('returns updated mix.lock in umbrella project', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.getSiblingFileName.mockReturnValueOnce('apps/foo/mix.lock');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');

    const execSnapshots = mockExecAll();
    await expect(
      updateArtifacts({
        packageFileName: 'apps/foo/mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config: { ...config, constraints },
      }),
    ).resolves.toEqual([
      {
        file: {
          path: 'mix.lock',
          type: 'addition',
          contents: 'New mix.lock',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool erlang 25.0.0.0' },
      { cmd: 'install-tool elixir v1.13.4' },
      {
        cmd: 'mix deps.update plug',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('supports lockFileMaintenance', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');

    const execSnapshots = mockExecAll();
    await expect(
      updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: {
          ...config,
          constraints,
          isLockFileMaintenance: true,
        },
      }),
    ).resolves.toEqual([
      {
        file: {
          path: 'mix.lock',
          type: 'addition',
          contents: 'New mix.lock',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool erlang 25.0.0.0' },
      { cmd: 'install-tool elixir v1.13.4' },
      {
        cmd: 'mix deps.get',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('lockFileMaintenance returns null if unchanged', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');

    mockExecAll();
    await expect(
      updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...config, isLockFileMaintenance: true },
      }),
    ).resolves.toBeNull();
  });

  it('catches write errors', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current mix.lock');
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    await expect(
      updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config,
      }),
    ).resolves.toEqual([
      { artifactError: { fileName: 'mix.lock', stderr: 'not found' } },
    ]);
  });

  it('catches exec errors', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current mix.lock');
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    mockExecAll(new Error('exec-error'));
    await expect(
      updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config,
      }),
    ).resolves.toEqual([
      { artifactError: { fileName: 'mix.lock', stderr: 'exec-error' } },
    ]);
  });

  it('detects read errors', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.localPathExists.mockResolvedValueOnce(true);
    await expect(
      updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config,
      }),
    ).resolves.toEqual([
      {
        artifactError: {
          fileName: 'mix.lock',
          stderr: 'Error reading mix.lock',
        },
      },
    ]);
  });

  it('detects read errors (umbrella)', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('apps/foo/mix.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.localPathExists.mockResolvedValueOnce(false);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.localPathExists.mockResolvedValueOnce(true);
    await expect(
      updateArtifacts({
        packageFileName: 'apps/foo/mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config,
      }),
    ).resolves.toEqual([
      {
        artifactError: {
          fileName: 'mix.lock',
          stderr: 'Error reading mix.lock',
        },
      },
    ]);
  });

  it("handles updates and doesn't try to create mix.lock file if it doesn't exist", async () => {
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.localPathExists.mockResolvedValueOnce(false);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce(null);

    const execSnapshots = mockExecAll();

    await expect(
      updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: 'New mix.exs',
        config,
      }),
    ).resolves.toBeNull();

    expect(execSnapshots).toHaveLength(0);
    expect(fs.writeLocalFile).toHaveBeenCalledExactlyOnceWith(
      'mix.exs',
      'New mix.exs',
    );
  });
});
