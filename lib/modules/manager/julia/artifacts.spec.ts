import upath from 'upath';
import { type ExecSnapshots, exec, mockExecAll } from '~test/exec-util.ts';
import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { ExecError } from '../../../util/exec/exec-error.ts';
import type { UpdateArtifact } from '../types.ts';
import { updateArtifacts } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const juliaCommand =
  'julia --startup-file=no --history-file=no --project=. -e ';

/** Mocks `exec`, without juliaup installed. */
function mockExec(): ExecSnapshots {
  const execSnapshots = mockExecAll();
  exec.mockRejectedValueOnce(new Error('spawn juliaup ENOENT'));
  return execSnapshots;
}

describe('modules/manager/julia/artifacts', () => {
  describe('updateArtifacts()', () => {
    let updateArtifact: UpdateArtifact;

    beforeEach(() => {
      GlobalConfig.set({ localDir: '', binarySource: 'global' });
      fs.getSiblingFileName.mockImplementation((file, sibling) =>
        upath.join(upath.dirname(file), sibling),
      );
      fs.readLocalDirectory.mockResolvedValue([
        'Manifest.toml',
        'Project.toml',
      ]);
      fs.ensureCacheDir.mockResolvedValue('/cache/julia');
      updateArtifact = {
        config: {},
        newPackageFileContent: 'new project',
        packageFileName: 'pkg/Project.toml',
        updatedDeps: [{ depName: 'Example', newVersion: '0.5.5' }],
      };
    });

    it('returns null without updated deps or lock file maintenance', async () => {
      updateArtifact.updatedDeps = [];
      await expect(updateArtifacts(updateArtifact)).resolves.toBeNull();
    });

    it('returns null without a manifest', async () => {
      fs.readLocalDirectory.mockResolvedValueOnce(['Project.toml']);
      await expect(updateArtifacts(updateArtifact)).resolves.toBeNull();
      expect(fs.readLocalFile).not.toHaveBeenCalled();
    });

    it('returns null when the manifest cannot be read', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      await expect(updateArtifacts(updateArtifact)).resolves.toBeNull();
      expect(fs.readLocalFile).toHaveBeenCalledWith(
        'pkg/Manifest.toml',
        'utf8',
      );
    });

    it('updates the manifest to the new versions, without builds', async () => {
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      const execSnapshots = mockExec();

      await expect(updateArtifacts(updateArtifact)).resolves.toEqual([
        {
          file: {
            type: 'addition',
            path: 'pkg/Manifest.toml',
            contents: 'new',
          },
        },
      ]);
      expect(fs.writeLocalFile).toHaveBeenCalledWith(
        'pkg/Project.toml',
        'new project',
      );
      expect(execSnapshots).toMatchObject([
        {
          cmd: expect.toSatisfy(
            (cmd: string) =>
              cmd.startsWith(juliaCommand) &&
              cmd.endsWith(' Manifest.toml Example@0.5.5'),
          ),
          options: {
            env: {
              JULIA_DEPOT_PATH: '/cache/julia',
              JULIA_PKG_PRECOMPILE_AUTO: '0',
            },
          },
        },
      ]);
      expect(execSnapshots[0].cmd).toContain('julia_minor');
      expect(fs.ensureCacheDir).toHaveBeenCalledWith('julia/1.6');
    });

    it('takes the depot of the Julia that wrote the manifest', async () => {
      fs.readLocalFile.mockResolvedValueOnce('julia_version = "1.10.12"\n');
      fs.readLocalFile.mockResolvedValueOnce('new');
      mockExec();

      await updateArtifacts(updateArtifact);

      expect(fs.ensureCacheDir).toHaveBeenCalledWith('julia/1.10');
    });

    it('leaves out updated deps without a new version', async () => {
      updateArtifact.updatedDeps = [
        { depName: 'Example', newVersion: '0.5.5' },
        { depName: 'JSON' },
      ];
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      const execSnapshots = mockExec();

      await updateArtifacts(updateArtifact);

      expect(execSnapshots[0].cmd).toEndWith(' Manifest.toml Example@0.5.5');
    });

    it('runs Pkg as is when the repository may run package scripts', async () => {
      GlobalConfig.set({
        localDir: '',
        binarySource: 'global',
        allowScripts: true,
      });
      updateArtifact.config.ignoreScripts = false;
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      const execSnapshots = mockExec();

      await updateArtifacts(updateArtifact);

      expect(execSnapshots[0].cmd).not.toContain('julia_minor');
    });

    it.each([
      [{ allowScripts: true }, {}],
      [{}, { ignoreScripts: false }],
    ])(
      'skips builds unless both allow scripts: %o, %o',
      async (globalConfig, repoConfig) => {
        GlobalConfig.set({
          localDir: '',
          binarySource: 'global',
          ...globalConfig,
        });
        updateArtifact.config = repoConfig;
        fs.readLocalFile.mockResolvedValueOnce('old');
        fs.readLocalFile.mockResolvedValueOnce('new');
        const execSnapshots = mockExec();

        await updateArtifacts(updateArtifact);

        expect(execSnapshots[0].cmd).toContain('julia_minor');
      },
    );

    it('updates each manifest that a Julia version uses', async () => {
      fs.readLocalDirectory.mockResolvedValueOnce([
        'Manifest-v1.13.toml',
        'Manifest.toml',
        'Project.toml',
      ]);
      fs.readLocalFile.mockResolvedValueOnce('old 1.13');
      fs.readLocalFile.mockResolvedValueOnce('new 1.13');
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      const execSnapshots = mockExec();

      await expect(updateArtifacts(updateArtifact)).resolves.toEqual([
        {
          file: {
            type: 'addition',
            path: 'pkg/Manifest-v1.13.toml',
            contents: 'new 1.13',
          },
        },
        {
          file: {
            type: 'addition',
            path: 'pkg/Manifest.toml',
            contents: 'new',
          },
        },
      ]);
      expect(execSnapshots.map(({ cmd }) => cmd.split(' ').at(-2))).toEqual([
        'Manifest-v1.13.toml',
        'Manifest.toml',
      ]);
    });

    it('updates the manifest that the project names', async () => {
      updateArtifact.newPackageFileContent = 'manifest = "../Manifest.toml"\n';
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      const execSnapshots = mockExec();

      await expect(updateArtifacts(updateArtifact)).resolves.toMatchObject([
        { file: { path: 'Manifest.toml' } },
      ]);
      expect(execSnapshots[0].cmd).toEndWith(` ../Manifest.toml Example@0.5.5`);
    });

    it('runs the Julia that wrote the manifest with juliaup', async () => {
      fs.readLocalFile.mockResolvedValueOnce('julia_version = "1.10.12"\n');
      fs.readLocalFile.mockResolvedValueOnce('new');
      const execSnapshots = mockExecAll();

      await updateArtifacts(updateArtifact);

      expect(execSnapshots.map(({ cmd }) => cmd.split(' -e ')[0])).toEqual([
        'juliaup --version',
        'julia +1.10.12 --startup-file=no --history-file=no --project=.',
      ]);
    });

    it('runs Julia 1.6 with juliaup for a manifest without julia_version', async () => {
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      const execSnapshots = mockExecAll();

      await updateArtifacts(updateArtifact);

      expect(execSnapshots[1].cmd).toStartWith('julia +1.6 ');
    });

    it('passes the juliaup environment variables', async () => {
      vi.stubEnv('JULIAUP_DEPOT_PATH', '/opt/juliaup');
      vi.stubEnv('JULIAUP_SERVER', 'https://mirror.example.com');
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      const execSnapshots = mockExecAll();

      await updateArtifacts(updateArtifact);

      const juliaupEnv = {
        JULIAUP_DEPOT_PATH: '/opt/juliaup',
        JULIAUP_SERVER: 'https://mirror.example.com',
      };
      expect(execSnapshots).toMatchObject([
        { options: { env: juliaupEnv } },
        { options: { env: juliaupEnv } },
      ]);
      expect(execSnapshots[0].options?.env).not.toHaveProperty(
        'JULIAUP_NIGHTLY_SERVER',
      );
    });

    it('looks for juliaup only with binarySource=global', async () => {
      GlobalConfig.set({ localDir: '', binarySource: 'install' });
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      const execSnapshots = mockExecAll();

      await updateArtifacts(updateArtifact);

      expect(execSnapshots).toHaveLength(1);
      expect(execSnapshots[0].cmd).toStartWith(juliaCommand);
    });

    it('updates all packages for lock file maintenance', async () => {
      updateArtifact.updatedDeps = [];
      updateArtifact.config.isLockFileMaintenance = true;
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      const execSnapshots = mockExec();

      await updateArtifacts(updateArtifact);

      expect(execSnapshots).toMatchObject([
        {
          cmd: expect.toSatisfy(
            (cmd: string) =>
              cmd.startsWith(juliaCommand) && cmd.endsWith(' Manifest.toml'),
          ),
        },
      ]);
    });

    it('returns null for an unchanged manifest', async () => {
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('old');
      mockExec();
      await expect(updateArtifacts(updateArtifact)).resolves.toBeNull();
    });

    it('quotes package names', async () => {
      updateArtifact.updatedDeps = [{ depName: '|| date', newVersion: '1' }];
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      const execSnapshots = mockExec();

      await updateArtifacts(updateArtifact);

      expect(execSnapshots[0].cmd).toEndWith(` '|| date@1'`);
    });

    it('rethrows a temporary error', async () => {
      fs.readLocalFile.mockResolvedValueOnce('old');
      exec.mockRejectedValueOnce(new Error('spawn juliaup ENOENT'));
      exec.mockRejectedValueOnce(new Error(TEMPORARY_ERROR));
      await expect(updateArtifacts(updateArtifact)).rejects.toThrow(
        TEMPORARY_ERROR,
      );
    });

    it('returns an artifact error when Pkg fails, and goes on', async () => {
      fs.readLocalDirectory.mockResolvedValueOnce([
        'Manifest-v1.13.toml',
        'Manifest.toml',
      ]);
      fs.readLocalFile.mockResolvedValueOnce('old 1.13');
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      mockExec();
      exec.mockRejectedValueOnce(
        new ExecError('julia failed', {
          cmd: '',
          stdout: '',
          stderr: 'ERROR: Julia 1.13.1 wrote Manifest-v1.13.toml',
          options: {},
        }),
      );

      await expect(updateArtifacts(updateArtifact)).resolves.toEqual([
        {
          artifactError: {
            fileName: 'pkg/Manifest-v1.13.toml',
            stderr: 'ERROR: Julia 1.13.1 wrote Manifest-v1.13.toml',
          },
        },
        {
          file: {
            type: 'addition',
            path: 'pkg/Manifest.toml',
            contents: 'new',
          },
        },
      ]);
    });
  });
});
