import _fs from 'fs-extra';
import { mocked } from '../../../../test/util';
import { getConfig } from '../../../config/defaults';
import { PostUpdateConfig } from '../../../manager/common';
import * as _lockFiles from '../../../manager/npm/post-update';
import * as _lerna from '../../../manager/npm/post-update/lerna';
import * as _npm from '../../../manager/npm/post-update/npm';
import * as _pnpm from '../../../manager/npm/post-update/pnpm';
import * as _yarn from '../../../manager/npm/post-update/yarn';
import { platform as _platform } from '../../../platform';
import * as _hostRules from '../../../util/host-rules';

const defaultConfig = getConfig();

const fs = mocked(_fs);
const lockFiles = mocked(_lockFiles);
const npm = mocked(_npm);
const yarn = mocked(_yarn);
const pnpm = mocked(_pnpm);
const lerna = mocked(_lerna);
const hostRules = mocked(_hostRules);
const platform = mocked(_platform);

hostRules.find = jest.fn((_) => ({
  token: 'abc',
}));

const { writeUpdatedPackageFiles, getAdditionalFiles } = lockFiles;

describe('manager/npm/post-update', () => {
  describe('writeUpdatedPackageFiles', () => {
    let config: PostUpdateConfig;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        localDir: 'some-tmp-dir',
      };
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
          name: 'Dockerfile',
          contents: 'some-contents',
        },
      ];
      await writeUpdatedPackageFiles(config);
      expect(fs.outputFile).toHaveBeenCalledTimes(0);
    });
    it('writes updated packageFiles', async () => {
      config.updatedPackageFiles = [
        {
          name: 'package.json',
          contents: '{ "name": "{{some-template}}" }',
        },
        {
          name: 'backend/package.json',
          contents:
            '{ "name": "some-other-name", "engines": { "node": "^6.0.0" }}',
        },
      ];
      config.upgrades = [];
      await writeUpdatedPackageFiles(config);
      expect(fs.outputFile).toHaveBeenCalledTimes(2);
      expect(fs.outputFile.mock.calls[1][1]).not.toContain('"engines"');
    });
  });
  describe('getAdditionalFiles', () => {
    let config: PostUpdateConfig;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        localDir: 'some-tmp-dir',
      };
      platform.getFile.mockResolvedValueOnce('some lock file contents');
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
      platform.branchExists.mockResolvedValueOnce(true);
      const res = await getAdditionalFiles(config, { npm: [{}] });
      expect(res).toMatchSnapshot();
      expect(res.artifactErrors).toHaveLength(0);
      expect(res.updatedArtifacts).toHaveLength(0);
    });
  });
});
