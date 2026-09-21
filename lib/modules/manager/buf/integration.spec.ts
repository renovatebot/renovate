import { codeBlock } from 'common-tags';
import { mockExecAll } from '~test/exec-util.ts';
import { env, fs, git } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { getUpdatedPackageFiles } from '../../../workers/repository/update/branch/get-updated.ts';
import type { BranchConfig } from '../../../workers/types.ts';

// End-to-end through the REAL branch worker + auto-replace + buf manager. Only
// the true boundaries are faked: git file reads, the fs the manager touches,
// and the `buf` binary. This proves the "buf.lock is the package file" design
// actually produces a branch (get-updated -> autoReplace -> updateArtifacts).
vi.mock('../../../util/git/index.ts');
vi.mock('../../../util/fs/index.ts');
vi.mock('../../../util/exec/env.ts');

describe('modules/manager/buf/integration', () => {
  beforeEach(() => {
    GlobalConfig.set({ localDir: '/tmp/repo' });
    env.getChildProcessEnv.mockReturnValue({ ...process.env });
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('applies a buf.lock digest bump: autoReplace swaps the commit and buf dep update regenerates the lock', async () => {
    const oldCommit = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const newCommit = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const oldLock = codeBlock`
      version: v2
      deps:
        - name: buf.build/googleapis/googleapis
          commit: ${oldCommit}
          digest: b5:staledigestfromtheoldcommit
    `;
    // what autoReplace produces: commit swapped, but the b5 digest is stale
    const autoReplacedLock = oldLock.replace(oldCommit, newCommit);
    // what `buf dep update` produces: commit AND digest are correct
    const regeneratedLock = codeBlock`
      version: v2
      deps:
        - name: buf.build/googleapis/googleapis
          commit: ${newCommit}
          digest: b5:freshdigestfromthenewcommit
    `;

    git.getFile.mockResolvedValue(oldLock);
    fs.getSiblingFileName.mockReturnValue('buf.yaml');
    // updateArtifacts reads the on-disk lock, checks the sibling buf.yaml for
    // commit pins to advance (this dep is unpinned, so it's a no-op), then
    // re-reads the lock after buf runs
    fs.readLocalFile.mockResolvedValueOnce(oldLock);
    fs.readLocalFile.mockResolvedValueOnce(
      'version: v2\ndeps:\n  - buf.build/googleapis/googleapis\n',
    );
    fs.readLocalFile.mockResolvedValueOnce(regeneratedLock);
    const execSnapshots = mockExecAll();

    const config: BranchConfig = {
      baseBranch: 'main',
      manager: 'buf',
      branchName: 'renovate/buf',
      upgrades: [
        {
          manager: 'buf',
          branchName: 'renovate/buf',
          packageFile: 'buf.lock',
          depName: 'googleapis/googleapis',
          datasource: 'buf-module',
          registryUrls: ['https://buf.build'],
          updateType: 'digest',
          currentDigest: oldCommit,
          newDigest: newCommit,
          depIndex: 0,
        },
      ],
    };

    const res = await getUpdatedPackageFiles(config);

    // buf dep update actually ran
    expect(execSnapshots).toMatchObject([{ cmd: 'buf dep update' }]);
    expect(fs.writeLocalFile).toHaveBeenCalledWith(
      'buf.lock',
      autoReplacedLock,
    );

    // autoReplace produced the (stale-digest) package-file change...
    expect(res.updatedPackageFiles).toEqual([
      { type: 'addition', path: 'buf.lock', contents: autoReplacedLock },
    ]);
    // ...and updateArtifacts produced the correct lock as an artifact. Both
    // target buf.lock; at commit time updatedArtifacts is concatenated last, so
    // the correct content wins.
    expect(res.updatedArtifacts).toEqual([
      { type: 'addition', path: 'buf.lock', contents: regeneratedLock },
    ]);
    expect(res.artifactErrors).toEqual([]);
  });

  it('advances a commit-pinned buf.yaml so buf dep update does not revert the bump', async () => {
    const oldCommit = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const newCommit = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const oldLock = codeBlock`
      version: v2
      deps:
        - name: buf.build/googleapis/googleapis
          commit: ${oldCommit}
          digest: b5:staledigestfromtheoldcommit
    `;
    const autoReplacedLock = oldLock.replace(oldCommit, newCommit);
    const regeneratedLock = codeBlock`
      version: v2
      deps:
        - name: buf.build/googleapis/googleapis
          commit: ${newCommit}
          digest: b5:freshdigestfromthenewcommit
    `;
    // buf.yaml pins the module to the old commit - this is what buf dep update
    // re-resolves from, so it must be advanced or the bump is reverted.
    const oldBufYaml = `version: v2\ndeps:\n  - buf.build/googleapis/googleapis:${oldCommit}\n`;
    const newBufYaml = `version: v2\ndeps:\n  - buf.build/googleapis/googleapis:${newCommit}\n`;

    git.getFile.mockResolvedValue(oldLock);
    fs.getSiblingFileName.mockReturnValue('buf.yaml');
    fs.readLocalFile.mockResolvedValueOnce(oldLock); // initial buf.lock
    fs.readLocalFile.mockResolvedValueOnce(oldBufYaml); // sibling buf.yaml (pinned)
    fs.readLocalFile.mockResolvedValueOnce(regeneratedLock); // buf.lock after buf
    const execSnapshots = mockExecAll();

    const config: BranchConfig = {
      baseBranch: 'main',
      manager: 'buf',
      branchName: 'renovate/buf',
      upgrades: [
        {
          manager: 'buf',
          branchName: 'renovate/buf',
          packageFile: 'buf.lock',
          depName: 'googleapis/googleapis',
          datasource: 'buf-module',
          registryUrls: ['https://buf.build'],
          updateType: 'digest',
          currentDigest: oldCommit,
          newDigest: newCommit,
          depIndex: 0,
        },
      ],
    };

    const res = await getUpdatedPackageFiles(config);

    expect(execSnapshots).toMatchObject([{ cmd: 'buf dep update' }]);
    // the pin in buf.yaml was advanced ahead of buf dep update
    expect(fs.writeLocalFile).toHaveBeenCalledWith('buf.yaml', newBufYaml);
    // both the advanced buf.yaml and the regenerated buf.lock are committed,
    // buf.yaml first
    expect(res.updatedArtifacts).toEqual([
      { type: 'addition', path: 'buf.yaml', contents: newBufYaml },
      { type: 'addition', path: 'buf.lock', contents: regeneratedLock },
    ]);
    expect(res.updatedPackageFiles).toEqual([
      { type: 'addition', path: 'buf.lock', contents: autoReplacedLock },
    ]);
    expect(res.artifactErrors).toEqual([]);
  });

  it('applies a buf.gen.yaml plugin bump without running buf dep update', async () => {
    const genYaml = codeBlock`
      version: v2
      plugins:
        - remote: buf.build/protocolbuffers/go:v1.0.0
          out: gen/go
    `;
    git.getFile.mockResolvedValue(genYaml);
    const execSnapshots = mockExecAll();

    const config: BranchConfig = {
      baseBranch: 'main',
      manager: 'buf',
      branchName: 'renovate/buf-plugin',
      upgrades: [
        {
          manager: 'buf',
          branchName: 'renovate/buf-plugin',
          packageFile: 'buf.gen.yaml',
          depName: 'protocolbuffers/go',
          datasource: 'buf-plugin',
          registryUrls: ['https://buf.build'],
          currentValue: 'v1.0.0',
          newValue: 'v1.1.0',
          replaceString: 'buf.build/protocolbuffers/go:v1.0.0',
          autoReplaceStringTemplate:
            'buf.build/protocolbuffers/go:{{#if newValue}}{{newValue}}{{/if}}',
          depIndex: 0,
        },
      ],
    };

    const res = await getUpdatedPackageFiles(config);

    expect(res.updatedPackageFiles).toEqual([
      {
        type: 'addition',
        path: 'buf.gen.yaml',
        contents: genYaml.replace('v1.0.0', 'v1.1.0'),
      },
    ]);
    // the plugin update is applied in-place; nothing to regenerate
    expect(res.updatedArtifacts).toEqual([]);
    expect(execSnapshots).toEqual([]);
  });
});
