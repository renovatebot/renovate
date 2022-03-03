import { git, mocked } from '../../../../test/util';
import { getConfig } from '../../../config/defaults';
import { GlobalConfig } from '../../../config/global';
import * as _lockFiles from '../../../modules/manager/npm/post-update';
import * as _lerna from '../../../modules/manager/npm/post-update/lerna';
import * as _npm from '../../../modules/manager/npm/post-update/npm';
import * as _pnpm from '../../../modules/manager/npm/post-update/pnpm';
import * as _yarn from '../../../modules/manager/npm/post-update/yarn';
import type { PostUpdateConfig } from '../../../modules/manager/types';
import * as _fs from '../../../util/fs/proxies';
import * as _hostRules from '../../../util/host-rules';

const config: PostUpdateConfig = getConfig();

const fs = mocked(_fs);
const lockFiles = mocked(_lockFiles);
const npm = mocked(_npm);
const yarn = mocked(_yarn);
const pnpm = mocked(_pnpm);
const lerna = mocked(_lerna);
const hostRules = mocked(_hostRules);

jest.mock('../../../util/git');

hostRules.find = jest.fn((_) => ({
  token: 'abc',
}));

const { writeUpdatedPackageFiles, getAdditionalFiles } = lockFiles;

describe('workers/branch/lock-files/index', () => {
  describe('writeUpdatedPackageFiles', () => {
    beforeEach(() => {
      GlobalConfig.set({
        localDir: 'some-tmp-dir',
      });
      fs.outputFile = jest.fn();
    });
    it('returns if no updated packageFiles', async () => {
      delete config.updatedPackageFiles;
      await writeUpdatedPackageFiles(config);
      expect(fs.outputFile).toHaveBeenCalledTimes(0);
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
      expect(fs.outputFile).toHaveBeenCalledTimes(0);
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
      expect(fs.outputFile).toHaveBeenCalledTimes(2);
    });
  });
  describe('getAdditionalFiles', () => {
    beforeEach(() => {
      GlobalConfig.set({
        localDir: 'some-tmp-dir',
      });
      git.getFile.mockResolvedValueOnce('some lock file contents');
      npm.generateLockFile = jest.fn();
      npm.generateLockFile.mockResolvedValueOnce({
        lockFile: 'some lock file contents',
      });
      yarn.generateLockFile = jest.fn();
      yarn.generateLockFile.mockResolvedValueOnce({
        lockFile: 'some lock file contents',
      });
      pnpm.generateLockFile = jest.fn();
      pnpm.generateLockFile.mockResolvedValueOnce({
        lockFile: 'some lock file contents',
      });
      lerna.generateLockFiles = jest.fn();
      lockFiles.determineLockFileDirs = jest.fn();
    });
    afterEach(() => {
      jest.resetAllMocks();
    });
    it('returns no error and empty lockfiles if updateLockFiles false', async () => {
      config.updateLockFiles = false;
      const res = await getAdditionalFiles(config, { npm: [{}] });
      expect(res).toMatchSnapshot();
      expect(res.artifactErrors).toHaveLength(0);
      expect(res.updatedArtifacts).toHaveLength(0);
    });
    it('returns no error and empty lockfiles if lock file maintenance exists', async () => {
      config.updateType = 'lockFileMaintenance';
      config.reuseExistingBranch = true;
      git.branchExists.mockReturnValueOnce(true);
      const res = await getAdditionalFiles(config, { npm: [{}] });
      expect(res).toMatchSnapshot();
      expect(res.artifactErrors).toHaveLength(0);
      expect(res.updatedArtifacts).toHaveLength(0);
    });
  });
});
