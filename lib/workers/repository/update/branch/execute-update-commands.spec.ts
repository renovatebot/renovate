import { fs, git, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import * as _exec from '../../../../util/exec/index.ts';
import * as _gitAuth from '../../../../util/git/auth.ts';
import type { StatusResult } from '../../../../util/git/types.ts';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types.ts';
import { executeCustomUpdateCommands } from './execute-update-commands.ts';

vi.mock('../../../../util/exec/index.ts');
vi.mock('../../../../util/fs/index.ts');
vi.mock('../../../../util/git/auth.ts');

const exec = vi.mocked(_exec);
const gitAuth = vi.mocked(_gitAuth);

describe('workers/repository/update/branch/execute-update-commands', () => {
  let localDir: string;

  beforeEach(() => {
    GlobalConfig.reset();
    localDir = '/tmp/test-renovate';
    GlobalConfig.set({
      localDir,
      allowedCommands: ['allowed-command.*'],
    });
    gitAuth.getGitEnvironmentVariables.mockReturnValue({});
  });

  function makeConfig(
    upgradeOverrides?: Partial<BranchUpgradeConfig>,
  ): [BranchUpgradeConfig, BranchConfig] {
    const upgrade: BranchUpgradeConfig = {
      manager: 'some-manager',
      branchName: 'renovate/test',
      packageFile: 'backstage.json',
      depName: 'backstage/backstage',
      newValue: '1.2.3',
      currentValue: '1.0.0',
      customUpdateCommands: {
        commands: ['allowed-command {{{newValue}}}'],
        fileFilters: ['**/*'],
      },
      ...upgradeOverrides,
    };
    const config: BranchConfig = {
      manager: 'some-manager',
      branchName: 'renovate/test',
      baseBranch: 'main',
      upgrades: [upgrade],
    };
    return [upgrade, config];
  }

  it('returns empty results when customUpdateCommands is not set', async () => {
    const [upgrade, config] = makeConfig({ customUpdateCommands: undefined });
    const result = await executeCustomUpdateCommands(upgrade, config);
    expect(result).toEqual({
      updatedPackageFiles: [],
      updatedArtifacts: [],
      artifactErrors: [],
    });
    expect(exec.exec).not.toHaveBeenCalled();
  });

  it('returns empty results when commands array is empty', async () => {
    const [upgrade, config] = makeConfig({
      customUpdateCommands: { commands: [] },
    });
    const result = await executeCustomUpdateCommands(upgrade, config);
    expect(result).toEqual({
      updatedPackageFiles: [],
      updatedArtifacts: [],
      artifactErrors: [],
    });
    expect(exec.exec).not.toHaveBeenCalled();
  });

  it('compiles command template with upgrade context', async () => {
    const [upgrade, config] = makeConfig();
    exec.exec.mockResolvedValueOnce({ stdout: '', stderr: '' });
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
        not_added: [],
        deleted: [],
        renamed: [],
      }),
    );

    await executeCustomUpdateCommands(upgrade, config);

    expect(exec.exec).toHaveBeenCalledWith(
      'allowed-command 1.2.3',
      expect.any(Object),
    );
  });

  it('executes command with default shell=false', async () => {
    const [upgrade, config] = makeConfig();
    exec.exec.mockResolvedValueOnce({ stdout: '', stderr: '' });
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
        not_added: [],
        deleted: [],
        renamed: [],
      }),
    );

    await executeCustomUpdateCommands(upgrade, config);

    expect(exec.exec).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ shell: false, cwd: localDir }),
    );
  });

  it('executes command with shell=true when allowShellExecutorForPostUpgradeCommands=true', async () => {
    GlobalConfig.set({
      localDir,
      allowedCommands: ['allowed-command.*'],
      allowShellExecutorForPostUpgradeCommands: true,
    });
    const [upgrade, config] = makeConfig();
    exec.exec.mockResolvedValueOnce({ stdout: '', stderr: '' });
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
        not_added: [],
        deleted: [],
        renamed: [],
      }),
    );

    await executeCustomUpdateCommands(upgrade, config);

    expect(exec.exec).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ shell: true }),
    );
  });

  it('adds artifact error when command does not match allowedCommands', async () => {
    GlobalConfig.set({
      localDir,
      allowedCommands: ['^only-this-exact-command$'],
    });
    const [upgrade, config] = makeConfig({
      customUpdateCommands: {
        commands: ['disallowed-command'],
      },
    });
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
        not_added: [],
        deleted: [],
        renamed: [],
      }),
    );

    const result = await executeCustomUpdateCommands(upgrade, config);

    expect(exec.exec).not.toHaveBeenCalled();
    expect(result.artifactErrors).toHaveLength(1);
    expect(result.artifactErrors[0].stderr).toContain(
      'has not been added to the allowed list',
    );
  });

  it('adds artifact error when command execution fails', async () => {
    const [upgrade, config] = makeConfig();
    exec.exec.mockRejectedValueOnce(new Error('command failed'));
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
        not_added: [],
        deleted: [],
        renamed: [],
      }),
    );

    const result = await executeCustomUpdateCommands(upgrade, config);

    expect(result.artifactErrors).toHaveLength(1);
    expect(result.artifactErrors[0].stderr).toContain('command failed');
    expect(result.artifactErrors[0].fileName).toBe('backstage.json');
  });

  it('captures modified packageFile as updatedPackageFiles', async () => {
    const [upgrade, config] = makeConfig();
    exec.exec.mockResolvedValueOnce({ stdout: '', stderr: '' });
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['backstage.json'],
        not_added: [],
        deleted: [],
        renamed: [],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('{"version":"1.2.3"}');

    const result = await executeCustomUpdateCommands(upgrade, config);

    expect(result.updatedPackageFiles).toHaveLength(1);
    expect(result.updatedPackageFiles[0].path).toBe('backstage.json');
    expect(result.updatedPackageFiles[0].type).toBe('addition');
    expect(result.updatedArtifacts).toHaveLength(0);
  });

  it('captures non-packageFile changes as updatedArtifacts', async () => {
    const [upgrade, config] = makeConfig();
    exec.exec.mockResolvedValueOnce({ stdout: '', stderr: '' });
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['package.json'],
        not_added: ['yarn.lock'],
        deleted: [],
        renamed: [],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('{"name":"app"}')
      .mockResolvedValueOnce('lockfile content');

    const result = await executeCustomUpdateCommands(upgrade, config);

    expect(result.updatedArtifacts).toHaveLength(2);
    expect(result.updatedArtifacts.map((f) => f.path)).toContain(
      'package.json',
    );
    expect(result.updatedArtifacts.map((f) => f.path)).toContain('yarn.lock');
    expect(result.updatedPackageFiles).toHaveLength(0);
  });

  it('captures deleted files', async () => {
    const [upgrade, config] = makeConfig();
    exec.exec.mockResolvedValueOnce({ stdout: '', stderr: '' });
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
        not_added: [],
        deleted: ['old-file.txt'],
        renamed: [],
      }),
    );

    const result = await executeCustomUpdateCommands(upgrade, config);

    expect(result.updatedArtifacts).toHaveLength(1);
    expect(result.updatedArtifacts[0]).toEqual({
      type: 'deletion',
      path: 'old-file.txt',
    });
  });

  it('respects fileFilters and excludes non-matching files', async () => {
    const [upgrade, config] = makeConfig({
      customUpdateCommands: {
        commands: ['allowed-command 1.2.3'],
        fileFilters: ['backstage.json', 'package.json'],
      },
    });
    exec.exec.mockResolvedValueOnce({ stdout: '', stderr: '' });
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['backstage.json', 'package.json', 'yarn.lock'],
        not_added: [],
        deleted: [],
        renamed: [],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('content1')
      .mockResolvedValueOnce('content2');

    const result = await executeCustomUpdateCommands(upgrade, config);

    const allFiles = [
      ...result.updatedPackageFiles,
      ...result.updatedArtifacts,
    ].map((f) => f.path);
    expect(allFiles).toContain('backstage.json');
    expect(allFiles).toContain('package.json');
    expect(allFiles).not.toContain('yarn.lock');
  });

  it('uses workingDirTemplate when set', async () => {
    const [upgrade, config] = makeConfig({
      customUpdateCommands: {
        commands: ['allowed-command 1.2.3'],
        workingDirTemplate: '/tmp/custom-dir',
      },
    });
    exec.exec.mockResolvedValueOnce({ stdout: '', stderr: '' });
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
        not_added: [],
        deleted: [],
        renamed: [],
      }),
    );
    fs.ensureLocalDir.mockResolvedValueOnce('/tmp/custom-dir');

    await executeCustomUpdateCommands(upgrade, config);

    expect(fs.ensureLocalDir).toHaveBeenCalledWith('/tmp/custom-dir');
    expect(exec.exec).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cwd: '/tmp/custom-dir' }),
    );
  });

  it('passes toolConstraints from installTools', async () => {
    const [upgrade, config] = makeConfig({
      constraints: { node: '>=18' },
      customUpdateCommands: {
        commands: ['allowed-command 1.2.3'],
        installTools: { node: {} },
      },
    });
    exec.exec.mockResolvedValueOnce({ stdout: '', stderr: '' });
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
        not_added: [],
        deleted: [],
        renamed: [],
      }),
    );

    await executeCustomUpdateCommands(upgrade, config);

    expect(exec.exec).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        toolConstraints: [{ toolName: 'node', constraint: '>=18' }],
      }),
    );
  });

  it('captures renamed files as additions and removes old paths', async () => {
    const [upgrade, config] = makeConfig();
    exec.exec.mockResolvedValueOnce({ stdout: '', stderr: '' });
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
        not_added: [],
        deleted: [],
        renamed: [{ from: 'old-name.txt', to: 'new-name.txt' }],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('renamed content');

    const result = await executeCustomUpdateCommands(upgrade, config);

    const paths = [
      ...result.updatedPackageFiles,
      ...result.updatedArtifacts,
    ].map((f) => f.path);
    expect(paths).toContain('new-name.txt');
  });

  it('captures both packageFile and artifact changes from a single command', async () => {
    const [upgrade, config] = makeConfig();
    exec.exec.mockResolvedValueOnce({ stdout: '', stderr: '' });
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['backstage.json'],
        not_added: ['packages/app/package.json', 'yarn.lock'],
        deleted: [],
        renamed: [],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('{"version":"1.2.3"}')
      .mockResolvedValueOnce('{"name":"app"}')
      .mockResolvedValueOnce('lockfile');

    const result = await executeCustomUpdateCommands(upgrade, config);

    expect(result.updatedPackageFiles).toHaveLength(1);
    expect(result.updatedPackageFiles[0].path).toBe('backstage.json');
    expect(result.updatedArtifacts).toHaveLength(2);
  });
});
