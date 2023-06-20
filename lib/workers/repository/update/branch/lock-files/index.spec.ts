import { fs, git, mocked } from '../../../../../../test/util';
import { GlobalConfig } from '../../../../../config/global';
import * as lockFiles from '../../../../../modules/manager/npm/post-update';
import * as lerna from '../../../../../modules/manager/npm/post-update/lerna';
import * as npm from '../../../../../modules/manager/npm/post-update/npm';
import * as pnpm from '../../../../../modules/manager/npm/post-update/pnpm';
import * as yarn from '../../../../../modules/manager/npm/post-update/yarn';
import type { PostUpdateConfig } from '../../../../../modules/manager/types';
import * as _hostRules from '../../../../../util/host-rules';

const config: PostUpdateConfig = {
  upgrades: [],
  branchName: 'some-branch',
};

const hostRules = mocked(_hostRules);

jest.mock('../../../../../util/git');
jest.mock('../../../../../util/fs');

hostRules.find = jest.fn((_) => ({
  token: 'abc',
}));

const { writeUpdatedPackageFiles, getAdditionalFiles } = lockFiles;

describe('workers/repository/update/branch/lock-files/index', () => {
  describe('writeUpdatedPackageFiles', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      GlobalConfig.set({
        localDir: 'some-tmp-dir',
      });
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
      jest.spyOn(npm, 'generateLockFile').mockResolvedValueOnce({
        lockFile: 'some lock file contents',
      });
      jest.spyOn(yarn, 'generateLockFile').mockResolvedValueOnce({
        lockFile: 'some lock file contents',
      });
      jest.spyOn(pnpm, 'generateLockFile').mockResolvedValueOnce({
        lockFile: 'some lock file contents',
      });
      jest.spyOn(lerna, 'generateLockFiles');
      jest.spyOn(lockFiles, 'determineLockFileDirs');
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('returns no error and empty lockfiles if updateLockFiles false', async () => {
      config.updateLockFiles = false;
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
