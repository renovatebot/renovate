/* v8 ignore file -- opt-in real-binary integration test */
import { execSync } from 'node:child_process';
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

const runIntegration =
  process.env.RUN_MISE_INTEGRATION === '1' &&
  hasBinary('mise') &&
  hasNetworkAccess();

const describeIntegration = runIntegration ? describe : describe.skip;

async function getModule() {
  return import('./artifacts.ts');
}

function hasBinary(binary: string): boolean {
  try {
    execSync(`command -v ${binary}`, { stdio: 'ignore', shell: '/bin/bash' });
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

  it('updates an existing mise lockfile without trusting the source config', async () => {
    const { updateArtifacts } = await getModule();

    const packageFileName = 'mise.toml';
    const lockFileName = 'mise.lock';
    const packageFilePath = upath.join(tmpDir.path, packageFileName);
    const lockFilePath = upath.join(tmpDir.path, lockFileName);

    await fs.writeFile(
      packageFilePath,
      ['[tools]', 'node = "24.15.0"', '', '[env]', 'FOO = "bar"', ''].join(
        '\n',
      ),
      'utf8',
    );

    await fs.writeFile(
      lockFilePath,
      [
        '[[tools.node]]',
        'version = "24.15.0"',
        'backend = "core:node"',
        '',
      ].join('\n'),
      'utf8',
    );

    execSync('git init -b main', { cwd: tmpDir.path, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', {
      cwd: tmpDir.path,
      stdio: 'ignore',
    });
    execSync('git config user.name "Test User"', {
      cwd: tmpDir.path,
      stdio: 'ignore',
    });
    execSync('git add mise.toml mise.lock && git commit -m "init"', {
      cwd: tmpDir.path,
      stdio: 'ignore',
      shell: '/bin/bash',
    });

    const res = await updateArtifacts({
      packageFileName,
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent:
        '[tools]\nnode = "24.16.0"\n\n[env]\nFOO = "bar"\n',
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
