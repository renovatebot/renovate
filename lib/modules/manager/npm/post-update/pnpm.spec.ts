import { codeBlock } from 'common-tags';
import { envMock, mockExecAll, mockExecSequence } from '~test/exec-util.ts';
import { Fixtures } from '~test/fixtures.ts';
import { env, fs, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import { ExecError } from '../../../../util/exec/exec-error.ts';
import type { PostUpdateConfig, Upgrade } from '../../types.ts';
import { getNodeToolConstraint } from './node-version.ts';
import * as pnpmHelper from './pnpm.ts';

vi.mock('../../../../util/exec/env.ts');
vi.mock('../../../../util/fs/index.ts');
vi.mock('./node-version.ts');

delete process.env.NPM_CONFIG_CACHE;
process.env.CONTAINERBASE = 'true';

const lockfileWithAiSdk = codeBlock`
  lockfileVersion: '9.0'
  packages:
    '@ai-sdk/xai@3.0.97':
      resolution: {integrity: sha512-abc}
`;

function mockPnpmFiles(workspaceFileContent?: string) {
  fs.getSiblingFileName.mockReturnValue('some-folder/pnpm-workspace.yaml');
  fs.readLocalFile.mockImplementation((fileName: string): Promise<string> => {
    if (fileName === 'some-folder/pnpm-lock.yaml') {
      return Promise.resolve('package-lock-contents');
    }
    if (
      fileName === 'some-folder/pnpm-workspace.yaml' &&
      workspaceFileContent
    ) {
      return Promise.resolve(workspaceFileContent);
    }
    return Promise.resolve('unexpected file name');
  });
  fs.localPathExists.mockResolvedValueOnce(workspaceFileContent !== undefined); // pnpm-workspace.yaml
}

function maturityError(packageName: string, version: string): ExecError {
  return new ExecError('pnpm failed', {
    cmd: 'pnpm install',
    stdout: '',
    stderr: `ERR_PNPM_NO_MATURE_MATCHING_VERSION  Version ${version} (released 2 days ago) of ${packageName} does not meet the minimumReleaseAge constraint\n`,
    options: {},
    exitCode: 1,
  });
}

describe('modules/manager/npm/post-update/pnpm', () => {
  let config: PostUpdateConfig;
  const upgrades: Upgrade[] = [{}];

  beforeEach(() => {
    config = partial<PostUpdateConfig>({ constraints: { pnpm: '^2.0.0' } });
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set({ localDir: '', binarySource: 'global' });
    vi.mocked(getNodeToolConstraint).mockResolvedValueOnce({
      toolName: 'node',
      constraint: '16.16.0',
    });
  });

  it('does nothing when no upgrades', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    await pnpmHelper.generateLockFile('some-dir', {}, config);
    expect(execSnapshots).toMatchObject([]);
  });

  it('generates lock files', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-dir',
      {},
      config,
      upgrades,
    );
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('catches errors', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockImplementation(() => {
      throw new Error('not found');
    });
    const res = await pnpmHelper.generateLockFile(
      'some-dir',
      {},
      config,
      upgrades,
    );
    expect(res.error).toBeTrue();
    expect(res.lockFile).toBeUndefined();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('finds pnpm globally', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-dir',
      {},
      config,
      upgrades,
    );
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('performs lock file updates', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-folder', {}, config, [
      { packageName: 'some-dep', newVersion: '1.0.1', isLockfileUpdate: true },
      {
        packageName: 'some-other-dep',
        newVersion: '1.1.0',
        isLockfileUpdate: true,
      },
    ]);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm update --no-save some-dep@1.0.1 some-other-dep@1.1.0 --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('performs lock file updates for workspace with packages', async () => {
    const execSnapshots = mockExecAll();
    mockPnpmFiles(
      codeBlock`
        packages:
          - pkg-a
      `,
    );

    const res = await pnpmHelper.generateLockFile('some-folder', {}, config, [
      { packageName: 'some-dep', newVersion: '1.0.1', isLockfileUpdate: true },
      {
        packageName: 'some-other-dep',
        newVersion: '1.1.0',
        isLockfileUpdate: true,
      },
    ]);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm update --no-save some-dep@1.0.1 some-other-dep@1.1.0 --lockfile-only --recursive --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('performs lock file updates for workspace with packages using pnpm 10.x', async () => {
    const execSnapshots = mockExecAll();
    mockPnpmFiles(
      codeBlock`
        packages:
          - pkg-a
          - pkg-b
      `,
    );
    const res = await pnpmHelper.generateLockFile(
      'some-folder',
      {},
      { ...config, constraints: { pnpm: '10.x' } },
      [
        {
          packageName: 'some-dep',
          newVersion: '1.0.1',
          isLockfileUpdate: true,
        },
        {
          packageName: 'some-other-dep',
          newVersion: '1.1.0',
          isLockfileUpdate: true,
        },
      ],
    );
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm update --no-save some-dep@1.0.1 some-other-dep@1.1.0 --lockfile-only --recursive --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('performs lock file updates for non workspace using pnpm 10.x', async () => {
    const execSnapshots = mockExecAll();
    mockPnpmFiles(); // no workspace file
    const res = await pnpmHelper.generateLockFile(
      'some-folder',
      {},
      { ...config, constraints: { pnpm: '10.x' } },
      [
        {
          packageName: 'some-dep',
          newVersion: '1.0.1',
          isLockfileUpdate: true,
        },
        {
          packageName: 'some-other-dep',
          newVersion: '1.1.0',
          isLockfileUpdate: true,
        },
      ],
    );
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm update --no-save some-dep@1.0.1 some-other-dep@1.1.0 --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('performs lock file updates for workspace with empty package list', async () => {
    const execSnapshots = mockExecAll();
    mockPnpmFiles(codeBlock`packages: []`);
    const res = await pnpmHelper.generateLockFile('some-folder', {}, config, [
      {
        packageName: 'some-dep',
        newVersion: '1.0.1',
        isLockfileUpdate: true,
      },
      {
        packageName: 'some-other-dep',
        newVersion: '1.1.0',
        isLockfileUpdate: true,
      },
    ]);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm update --no-save some-dep@1.0.1 some-other-dep@1.1.0 --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('performs lock file updates for workspace with config but no package list', async () => {
    const execSnapshots = mockExecAll();
    mockPnpmFiles(codeBlock`
      overrides:
        "foo@1.0.0>bar": "-"
`);
    const res = await pnpmHelper.generateLockFile('some-folder', {}, config, [
      {
        packageName: 'some-dep',
        newVersion: '1.0.1',
        isLockfileUpdate: true,
      },
      {
        packageName: 'some-other-dep',
        newVersion: '1.1.0',
        isLockfileUpdate: true,
      },
    ]);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm update --no-save some-dep@1.0.1 some-other-dep@1.1.0 --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('performs lock file updates and install when lock file updates mixed with regular updates', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-folder', {}, config, [
      {
        sharedVariableName: 'some-group',
        packageName: 'some-dep',
        newVersion: '1.1.0',
        isLockfileUpdate: true,
      },
      {
        sharedVariableName: 'some-group',
        packageName: 'some-other-dep',
        newVersion: '1.1.0',
        isLockfileUpdate: false,
      },
    ]);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
      {
        cmd: 'pnpm update --no-save some-dep@1.1.0 --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('performs lock file maintenance', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config, [
      { isLockFileMaintenance: true },
    ]);
    expect(fs.deleteLocalFile).toHaveBeenCalledTimes(1);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
  });

  it('performs dedupe', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const postUpdateOptions = ['pnpmDedupe'];
    const res = await pnpmHelper.generateLockFile(
      'some-dir',
      {},
      { ...config, postUpdateOptions },
      upgrades,
    );
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
      {
        cmd: 'pnpm dedupe --ignore-scripts',
      },
    ]);
  });

  it('uses the new version if packageManager is updated', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile('some-dir', {}, config, [
      {
        depType: 'packageManager',
        depName: 'pnpm',
        newValue: '6.16.1',
        newVersion: '6.16.1',
      },
    ]);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchSnapshot();
    // TODO: check docker preCommands
  });

  it('uses constraint version if parent json has constraints', async () => {
    const execSnapshots = mockExecAll();
    const configTemp = partial<PostUpdateConfig>();
    const fileContent = Fixtures.get('parent/package.json');
    fs.readLocalFile
      .mockResolvedValueOnce(fileContent)
      .mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-folder',
      {},
      configTemp,
      [
        {
          depType: 'packageManager',
          depName: 'pnpm',
        },
      ],
    );
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile',
        options: {
          cwd: 'some-folder',
          env: {
            HTTP_PROXY: 'http://example.com',
            HTTPS_PROXY: 'https://example.com',
            NO_PROXY: 'localhost',
            HOME: '/home/user',
            PATH: '/tmp/path',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
          },
          maxBuffer: 10485760,
          timeout: 900000,
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
        },
      },
    ]);
  });

  it('uses packageManager version and puts it into constraint', async () => {
    const execSnapshots = mockExecAll();
    const configTemp = partial<PostUpdateConfig>();
    const fileContent = Fixtures.get('manager-field/package.json');
    fs.readLocalFile
      .mockResolvedValueOnce(fileContent)
      .mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-folder',
      {},
      configTemp,
      [
        {
          depType: 'packageManager',
          depName: 'pnpm',
        },
      ],
    );
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile',
        options: {
          cwd: 'some-folder',
          env: {
            HTTP_PROXY: 'http://example.com',
            HTTPS_PROXY: 'https://example.com',
            NO_PROXY: 'localhost',
            HOME: '/home/user',
            PATH: '/tmp/path',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
          },
          maxBuffer: 10485760,
          timeout: 900000,
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
        },
      },
    ]);
  });

  it('uses volta version and puts it into constraint', async () => {
    const execSnapshots = mockExecAll();
    const configTemp = partial<PostUpdateConfig>();
    const fileContent = codeBlock`
    {
  "name": "parent",
  "version": "1.0.0",
  "engines": {
    "pnpm": "^6.0.0"
  },
  "engine-strict": true,
  "volta": {
    "pnpm": "6.15.0"
  }
}

    `;
    fs.readLocalFile
      .mockResolvedValueOnce(fileContent)
      .mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-folder',
      {},
      configTemp,
      [
        {
          depType: 'volta',
          depName: 'pnpm',
        },
      ],
    );
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile',
        options: {
          cwd: 'some-folder',
          env: {
            HTTP_PROXY: 'http://example.com',
            HTTPS_PROXY: 'https://example.com',
            NO_PROXY: 'localhost',
            HOME: '/home/user',
            PATH: '/tmp/path',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
          },
          maxBuffer: 10485760,
          timeout: 900000,
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: 'pipe',
        },
      },
    ]);
  });

  it('uses skips pnpm v7 if lockfileVersion indicates <7', async () => {
    mockExecAll();
    const configTemp = partial<PostUpdateConfig>();
    fs.readLocalFile
      .mockResolvedValueOnce('{}') // package.json
      .mockResolvedValue('lockfileVersion: 5.3\n'); // pnpm-lock.yaml
    const res = await pnpmHelper.generateLockFile(
      'some-folder',
      {},
      configTemp,
      [],
    );
    expect(res.lockFile).toBe('lockfileVersion: 5.3\n');
  });

  it('works for docker mode', async () => {
    GlobalConfig.set({
      localDir: '',
      cacheDir: '/tmp',
      binarySource: 'docker',
      allowScripts: true,
      dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
    });
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-dir',
      {},
      { ...config, constraints: { pnpm: '6.0.0' } },
      upgrades,
    );
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/renovatebot/base-image' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp":"/tmp" ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "some-dir" ' +
          'ghcr.io/renovatebot/base-image ' +
          'bash -l -c "' +
          'install-tool node 16.16.0 ' +
          '&& install-tool pnpm 6.0.0 ' +
          '&& pnpm install --lockfile-only' +
          '"',
      },
    ]);
  });

  it('works for install mode', async () => {
    GlobalConfig.set({
      localDir: '',
      cacheDir: '/tmp',
      binarySource: 'install',
    });
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-dir',
      {},
      { ...config, constraints: { pnpm: '6.0.0' } },
      upgrades,
    );
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0' },
      { cmd: 'install-tool pnpm 6.0.0' },
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile',
      },
    ]);
  });

  it('allows pnpmfile even if ignoring scripts', async () => {
    GlobalConfig.set({
      localDir: '',
      cacheDir: '/tmp',
      binarySource: 'install',
      allowScripts: true,
    });
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValue('package-lock-contents');
    const res = await pnpmHelper.generateLockFile(
      'some-dir',
      {},
      { ...config, constraints: { pnpm: '6.0.0' }, ignoreScripts: true },
      upgrades,
    );
    expect(res.lockFile).toBe('package-lock-contents');
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool node 16.16.0' },
      { cmd: 'install-tool pnpm 6.0.0' },
      {
        cmd: 'pnpm install --lockfile-only --ignore-scripts',
      },
    ]);
  });

  describe('passes NODE_OPTIONS', () => {
    it('if nodeMaxMemory set on global config', async () => {
      GlobalConfig.set({
        localDir: '',
        toolSettings: {
          nodeMaxMemory: 1234,
        },
        binarySource: 'global',
      });
      const execSnapshots = mockExecAll();
      fs.readLocalFile.mockResolvedValue('package-lock-contents');
      const res = await pnpmHelper.generateLockFile(
        'some-dir',
        {},
        {
          ...config,
        },
        upgrades,
      );
      expect(res.lockFile).toBe('package-lock-contents');
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile',
        },
      ]);

      expect(execSnapshots[0].options?.env?.NODE_OPTIONS).toEqual(
        '--max-old-space-size=1234',
      );
    });

    it('if nodeMaxMemory set on repo config', async () => {
      const execSnapshots = mockExecAll();
      fs.readLocalFile.mockResolvedValue('package-lock-contents');
      const res = await pnpmHelper.generateLockFile(
        'some-dir',
        {},
        {
          ...config,
          toolSettings: {
            nodeMaxMemory: 1234,
          },
        },
        upgrades,
      );
      expect(res.lockFile).toBe('package-lock-contents');
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile',
        },
      ]);

      expect(execSnapshots[0].options?.env?.NODE_OPTIONS).toEqual(
        '--max-old-space-size=1234',
      );
    });
  });

  describe('minimumReleaseAge maturity retry', () => {
    it('retries with CLI exclude when immature version is already in lockfile', async () => {
      const err = maturityError('@ai-sdk/xai', '3.0.97');
      const execSnapshots = mockExecSequence([err, { stdout: '', stderr: '' }]);
      fs.getSiblingFileName.mockReturnValue('some-folder/pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValue(false);
      fs.readLocalFile.mockImplementation((fileName: string) => {
        if (fileName.endsWith('pnpm-lock.yaml')) {
          return Promise.resolve(lockfileWithAiSdk);
        }
        return Promise.resolve('');
      });

      const res = await pnpmHelper.generateLockFile(
        'some-folder',
        {},
        config,
        upgrades,
      );

      expect(res.error).toBeUndefined();
      expect(res.maturityFallback).toBeTrue();
      expect(res.lockFile).toBe(lockfileWithAiSdk);
      expect(execSnapshots).toHaveLength(2);
      expect(execSnapshots[0].cmd).toBe(
        'pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile',
      );
      expect(execSnapshots[1].cmd).toContain(
        '--config.minimumReleaseAgeExclude[]=@ai-sdk/xai@3.0.97',
      );
    });

    it('does not override maturity for versions not in the pre-update lockfile', async () => {
      const err = maturityError('@ai-sdk/xai', '9.9.9');
      const execSnapshots = mockExecSequence([err]);
      fs.getSiblingFileName.mockReturnValue('some-folder/pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValue(false);
      fs.readLocalFile.mockImplementation((fileName: string) => {
        if (fileName.endsWith('pnpm-lock.yaml')) {
          return Promise.resolve(lockfileWithAiSdk);
        }
        return Promise.resolve('');
      });

      const res = await pnpmHelper.generateLockFile(
        'some-folder',
        {},
        config,
        upgrades,
      );

      expect(res.error).toBeTrue();
      expect(res.maturityFallback).toBeFalse();
      expect(execSnapshots).toHaveLength(1);
      expect(execSnapshots[0].cmd).not.toContain('minimumReleaseAgeExclude');
    });

    it('retries for security remediation targets without lockfile entry', async () => {
      const err = maturityError('ua-parser-js', '2.0.10');
      const execSnapshots = mockExecSequence([err, { stdout: '', stderr: '' }]);
      fs.getSiblingFileName.mockReturnValue('some-folder/pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValue(false);
      fs.readLocalFile.mockResolvedValue(
        'lockfileVersion: "9.0"\npackages: {}\n',
      );

      const res = await pnpmHelper.generateLockFile('some-folder', {}, config, [
        partial<Upgrade>({
          packageName: 'ua-parser-js',
          newVersion: '2.0.10',
          isVulnerabilityAlert: true,
        }),
      ]);

      expect(res.error).toBeUndefined();
      expect(res.maturityFallback).toBeTrue();
      expect(execSnapshots[1].cmd).toContain(
        '--config.minimumReleaseAgeExclude[]=ua-parser-js@2.0.10',
      );
    });

    it('accumulates excludes across sequential maturity failures', async () => {
      const execSnapshots = mockExecSequence([
        maturityError('@ai-sdk/xai', '3.0.97'),
        maturityError('lodash', '4.17.21'),
        { stdout: '', stderr: '' },
      ]);
      const lockfile = codeBlock`
        lockfileVersion: '9.0'
        packages:
          '@ai-sdk/xai@3.0.97':
            resolution: {integrity: a}
          lodash@4.17.21:
            resolution: {integrity: b}
      `;
      fs.getSiblingFileName.mockReturnValue('some-folder/pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValue(false);
      fs.readLocalFile.mockResolvedValue(lockfile);

      const res = await pnpmHelper.generateLockFile(
        'some-folder',
        {},
        config,
        upgrades,
      );

      expect(res.maturityFallback).toBeTrue();
      // First attempt fails; retry adds exclude(s). Depending on mock sequencing,
      // multiple maturity errors may be folded into successive retries.
      expect(execSnapshots.length).toBeGreaterThanOrEqual(2);
      const lastCmd = execSnapshots[execSnapshots.length - 1].cmd;
      expect(lastCmd).toContain('@ai-sdk/xai@3.0.97');
    });

    it('does not retry on non-maturity pnpm errors', async () => {
      const other = new ExecError('pnpm failed', {
        cmd: 'pnpm install',
        stdout: '',
        stderr: 'ERR_PNPM_OUTDATED_LOCKFILE cannot install',
        options: {},
        exitCode: 1,
      });
      const execSnapshots = mockExecSequence([other]);
      fs.getSiblingFileName.mockReturnValue('some-folder/pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValue(false);
      fs.readLocalFile.mockResolvedValue(lockfileWithAiSdk);

      const res = await pnpmHelper.generateLockFile(
        'some-folder',
        {},
        config,
        upgrades,
      );

      expect(res.error).toBeTrue();
      expect(execSnapshots).toHaveLength(1);
    });
  });

  describe('getConstraintsFromLockFile()', () => {
    it('returns null if no lock file', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      const res = await pnpmHelper.getConstraintFromLockFile('some-file-name');
      expect(res).toBeNull();
    });

    it('returns null when error reading lock file', async () => {
      fs.readLocalFile.mockRejectedValueOnce(new Error('foo'));
      const res = await pnpmHelper.getConstraintFromLockFile('some-file-name');
      expect(res).toBeNull();
    });

    it('returns null if no lockfileVersion', async () => {
      fs.readLocalFile.mockResolvedValueOnce('foo: bar\n');
      const res = await pnpmHelper.getConstraintFromLockFile('some-file-name');
      expect(res).toBeNull();
    });

    it('returns null if lockfileVersion is not a number or numeric string', async () => {
      fs.readLocalFile.mockResolvedValueOnce('lockfileVersion: foo\n');
      const res = await pnpmHelper.getConstraintFromLockFile('some-file-name');
      expect(res).toBeNull();
    });

    it('returns default if lockfileVersion is 1', async () => {
      fs.readLocalFile.mockResolvedValueOnce('lockfileVersion: 1\n');
      const res = await pnpmHelper.getConstraintFromLockFile('some-file-name');
      expect(res).toBe('>=3 <3.5.0');
    });

    it('maps supported versions', async () => {
      fs.readLocalFile.mockResolvedValueOnce('lockfileVersion: 5.3\n');
      const res = await pnpmHelper.getConstraintFromLockFile('some-file-name');
      expect(res).toBe('>=6 <7');
    });

    it('maps supported versions for v6', async () => {
      fs.readLocalFile.mockResolvedValueOnce("lockfileVersion: '6.0'\n");
      const res = await pnpmHelper.getConstraintFromLockFile('some-file-name');
      expect(res).toBe('>=7.24.2 <9');
    });

    it('maps supported versions for v9', async () => {
      fs.readLocalFile.mockResolvedValueOnce("lockfileVersion: '9.0'\n");
      const res = await pnpmHelper.getConstraintFromLockFile('some-file-name');
      expect(res).toBe('>=9');
    });
  });
});
