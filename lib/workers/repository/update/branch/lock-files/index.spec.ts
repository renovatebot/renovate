import { fs, git, hostRules } from '~test/util.ts';
import { GlobalConfig } from '../../../../../config/global.ts';
import * as lockFiles from '../../../../../modules/manager/npm/post-update/index.ts';
import * as npm from '../../../../../modules/manager/npm/post-update/npm.ts';
import * as pnpm from '../../../../../modules/manager/npm/post-update/pnpm.ts';
import * as yarn from '../../../../../modules/manager/npm/post-update/yarn.ts';
import type { PostUpdateConfig } from '../../../../../modules/manager/types.ts';

const config: PostUpdateConfig = {
  upgrades: [],
  branchName: 'some-branch',
};

vi.mock('../../../../../util/fs/index.ts');
vi.mock('../../../../../util/host-rules.ts');

const { writeUpdatedPackageFiles, getAdditionalFiles } = lockFiles;

describe('workers/repository/update/branch/lock-files/index', () => {
  describe('writeUpdatedPackageFiles', () => {
    beforeEach(() => {
      GlobalConfig.set({
        localDir: 'some-tmp-dir',
      });
      hostRules.find.mockImplementation((_) => ({
        token: 'abc',
      }));
    });

    it('returns if no updated packageFiles', async () => {
      delete config.updatedPackageFiles;
      await writeUpdatedPackageFiles(config);
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(0);
    });

    it('returns if no updated packageFiles are package.json', async () => {
      config.updatedPackageFiles = [
        {
          type: 'addition',
          path: 'Dockerfile',
          contents: 'some-contents',
        },
      ];
      await writeUpdatedPackageFiles(config);
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(0);
    });

    it('writes updated packageFiles', async () => {
      config.updatedPackageFiles = [
        {
          type: 'addition',
          path: 'package.json',
          contents: '{ "name": "{{some-template}}" }',
        },
        {
          type: 'addition',
          path: 'backend/package.json',
          contents:
            '{ "name": "some-other-name", "engines": { "node": "^6.0.0" }}',
        },
        {
          type: 'deletion',
          path: 'frontent/package.json',
        },
      ];
      config.upgrades = [];
      await writeUpdatedPackageFiles(config);
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAdditionalFiles', () => {
    beforeEach(() => {
      GlobalConfig.set({
        localDir: 'some-tmp-dir',
      });
      git.getFile.mockResolvedValueOnce('some lock file contents');
      vi.spyOn(npm, 'generateLockFile').mockResolvedValueOnce({
        lockFile: 'some lock file contents',
      });
      vi.spyOn(yarn, 'generateLockFile').mockResolvedValueOnce({
        lockFile: 'some lock file contents',
      });
      vi.spyOn(pnpm, 'generateLockFile').mockResolvedValueOnce({
        lockFile: 'some lock file contents',
      });
      vi.spyOn(lockFiles, 'determineLockFileDirs');
    });

    it('returns no error and empty lockfiles if skipArtifactsUpdate is true', async () => {
      config.skipArtifactsUpdate = true;
      const res = await getAdditionalFiles(config, { npm: [{}] });
      expect(res).toEqual({ artifactErrors: [], updatedArtifacts: [] });
    });

    it('returns no error and empty lockfiles if lock file maintenance exists', async () => {
      config.updateType = 'lockFileMaintenance';
      config.reuseExistingBranch = true;
      git.branchExists.mockReturnValueOnce(true);
      const res = await getAdditionalFiles(config, { npm: [{}] });
      expect(res).toEqual({ artifactErrors: [], updatedArtifacts: [] });
    });
  });
});
