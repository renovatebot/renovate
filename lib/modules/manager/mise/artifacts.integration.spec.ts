import {
  exec as execCallback,
  execFile as execFileCallback,
} from 'node:child_process';
import { promisify } from 'node:util';
import { stripIndent } from 'common-tags';
import fs from 'fs-extra';
import tmp from 'tmp-promise';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import * as git from '../../../util/git/index.ts';
import * as hostRules from '../../../util/host-rules.ts';

vi.unmock('../../../util/exec/common.ts');
vi.mock('../../../util/git/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../util/git/index.ts')>()),
  getFileList: vi.fn(),
}));

const exec = promisify(execCallback);
const execFile = promisify(execFileCallback);

async function getModule() {
  return import('./artifacts.ts');
}

async function hasBinary(binary: string): Promise<boolean> {
  try {
    await exec(`command -v ${binary}`, { shell: '/bin/bash' });
    return true;
  } catch {
    return false;
  }
}

function hasNetworkAccess(): boolean {
  return (
    process.env.CI !== 'true' ||
    process.env.RUN_MISE_INTEGRATION_NETWORK === '1'
  );
}

async function gitExec(cwd: string, ...args: string[]): Promise<void> {
  await execFile('git', args, { cwd });
}

const runIntegration =
  process.env.RUN_MISE_INTEGRATION === '1' &&
  process.env.RUN_MISE_INTEGRATION_TRUSTED === '1' &&
  (await hasBinary('mise')) &&
  hasNetworkAccess();

const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration('modules/manager/mise/artifacts integration', () => {
  let tmpDir: tmp.DirectoryResult;
  let originalHome: string | undefined;
  let originalXdgConfigHome: string | undefined;

  beforeEach(async () => {
    tmpDir = await tmp.dir({ unsafeCleanup: true });
    const adminConfig: RepoGlobalConfig = {
      localDir: tmpDir.path,
      cacheDir: upath.join(tmpDir.path, '.cache'),
      containerbaseDir: upath.join(tmpDir.path, '.cache/containerbase'),
      binarySource: 'global',
    };
    GlobalConfig.set(adminConfig);
    hostRules.clear();
    vi.mocked(git.getFileList).mockResolvedValue(['mise.toml']);
    originalHome = process.env.HOME;
    originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
    process.env.HOME = upath.join(tmpDir.path, '.home');
    process.env.XDG_CONFIG_HOME = upath.join(tmpDir.path, '.home/.config');
    await fs.ensureDir(process.env.XDG_CONFIG_HOME);
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    await tmpDir?.cleanup();
  });

  it('updates an existing mise lockfile from sanitized mirrored config', async () => {
    const { updateArtifacts } = await getModule();

    const packageFileName = 'mise.toml';
    const lockFileName = 'mise.lock';
    const packageFilePath = upath.join(tmpDir.path, packageFileName);
    const lockFilePath = upath.join(tmpDir.path, lockFileName);

    await fs.writeFile(
      packageFilePath,
      stripIndent`
        [tools]
        node = "24.15.0"

        [settings]
        lockfile = true
      `,
      'utf8',
    );

    await fs.writeFile(
      lockFilePath,
      stripIndent`
        [[tools.node]]
        version = "24.15.0"
        backend = "core:node"
      `,
      'utf8',
    );

    await gitExec(tmpDir.path, 'init', '-b', 'main');
    await gitExec(tmpDir.path, 'config', 'user.email', 'test@example.com');
    await gitExec(tmpDir.path, 'config', 'user.name', 'Test User');
    await gitExec(tmpDir.path, 'add', 'mise.toml', 'mise.lock');
    await gitExec(tmpDir.path, 'commit', '-m', 'init');

    const res = await updateArtifacts({
      packageFileName,
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: stripIndent`
        [tools]
        node = "24.16.0"

        [settings]
        lockfile = true
      `,
      config: {},
    });

    expect(res).toEqual([
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: expect.stringContaining('version = "24.16.0"'),
        },
      },
    ]);
  }, 60_000);
});
