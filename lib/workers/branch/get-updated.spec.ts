import { defaultConfig, mocked, platform } from '../../../test/util';
import * as datasourceGitSubmodules from '../../datasource/git-submodules';
import * as _composer from '../../manager/composer';
import * as _gitSubmodules from '../../manager/git-submodules';
import * as _npm from '../../manager/npm';
import { BranchConfig } from '../common';
import * as _autoReplace from './auto-replace';
import { getUpdatedPackageFiles } from './get-updated';

const composer = mocked(_composer);
const gitSubmodules = mocked(_gitSubmodules);
const npm = mocked(_npm);
const autoReplace = mocked(_autoReplace);

jest.mock('../../manager/composer');
jest.mock('../../manager/npm');
jest.mock('../../manager/git-submodules');
jest.mock('./auto-replace');

describe('workers/branch/get-updated', () => {
  describe('getUpdatedPackageFiles()', () => {
    let config: BranchConfig;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        upgrades: [],
      } as never;
      npm.updateDependency = jest.fn();
      platform.getFile.mockResolvedValueOnce('existing content');
    });
    it('handles autoreplace base updated', async () => {
      config.upgrades.push({ manager: 'html', branchName: undefined });
      autoReplace.doAutoReplace.mockResolvedValueOnce('updated-file');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles autoreplace branch no update', async () => {
      config.upgrades.push({ manager: 'html', branchName: undefined });
      autoReplace.doAutoReplace.mockResolvedValueOnce('existing content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles autoreplace failure', async () => {
      config.upgrades.push({ manager: 'html', branchName: undefined });
      autoReplace.doAutoReplace.mockResolvedValueOnce(null);
      await expect(getUpdatedPackageFiles(config)).rejects.toThrow();
    });
    it('handles autoreplace branch needs update', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({ manager: 'html', branchName: undefined });
      autoReplace.doAutoReplace.mockResolvedValueOnce(null);
      autoReplace.doAutoReplace.mockResolvedValueOnce('updated-file');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles empty', async () => {
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles null content', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        manager: 'npm',
      } as never);
      await expect(getUpdatedPackageFiles(config)).rejects.toThrow();
    });
    it('handles content change', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        manager: 'npm',
      } as never);
      npm.updateDependency.mockReturnValue('some new content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles lock files', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        manager: 'composer',
        branchName: undefined,
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            name: 'composer.json',
            contents: 'some contents',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles lockFileMaintenance', async () => {
      config.upgrades.push({
        manager: 'composer',
        updateType: 'lockFileMaintenance',
      } as never);
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            name: 'composer.json',
            contents: 'some contents',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles lockFileMaintenance error', async () => {
      config.upgrades.push({
        manager: 'composer',
        updateType: 'lockFileMaintenance',
      } as never);
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          artifactError: {
            lockFile: 'composer.lock',
            stderr: 'some error',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles lock file errors', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        manager: 'composer',
        branchName: undefined,
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          artifactError: {
            lockFile: 'composer.lock',
            stderr: 'some error',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles git submodules', async () => {
      config.upgrades.push({
        manager: 'git-submodules',
        datasource: datasourceGitSubmodules.id,
      } as never);
      gitSubmodules.updateDependency.mockResolvedValueOnce('existing content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
  });
});
