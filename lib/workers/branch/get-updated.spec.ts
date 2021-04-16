import { defaultConfig, getName, git, mocked } from '../../../test/util';
import * as datasourceGitRefs from '../../datasource/git-refs';
import * as _composer from '../../manager/composer';
import * as _gitSubmodules from '../../manager/git-submodules';
import * as _helmv3 from '../../manager/helmv3';
import * as _npm from '../../manager/npm';
import type { BranchConfig } from '../types';
import * as _autoReplace from './auto-replace';
import { getUpdatedPackageFiles } from './get-updated';

const composer = mocked(_composer);
const gitSubmodules = mocked(_gitSubmodules);
const helmv3 = mocked(_helmv3);
const npm = mocked(_npm);
const autoReplace = mocked(_autoReplace);

jest.mock('../../manager/composer');
jest.mock('../../manager/helmv3');
jest.mock('../../manager/npm');
jest.mock('../../manager/git-submodules');
jest.mock('../../util/git');
jest.mock('./auto-replace');

describe(getName(__filename), () => {
  describe('getUpdatedPackageFiles()', () => {
    let config: BranchConfig;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        upgrades: [],
      } as never;
      npm.updateDependency = jest.fn();
      git.getFile.mockResolvedValueOnce('existing content');
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
    it('handles isRemediation success', async () => {
      config.upgrades.push({
        manager: 'npm',
        isRemediation: true,
      } as never);
      npm.updateLockedDependency.mockResolvedValueOnce({
        'package-lock.json': 'new contents',
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles isRemediation rebase', async () => {
      config.upgrades.push({
        manager: 'npm',
        isRemediation: true,
      } as never);
      config.reuseExistingBranch = true;
      git.getFile.mockResolvedValueOnce('existing content');
      npm.updateLockedDependency.mockResolvedValue({
        'package-lock.json': 'new contents',
      });
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
        datasource: datasourceGitRefs.id,
      } as never);
      gitSubmodules.updateDependency.mockResolvedValueOnce('existing content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('update artifacts on update-lockfile strategy', async () => {
      config.upgrades.push({
        manager: 'composer',
        branchName: undefined,
        rangeStrategy: 'update-lockfile',
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('existing content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            name: 'composer.lock',
            contents: 'some contents',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('bumps versions in updateDependency managers', async () => {
      config.upgrades.push({
        branchName: undefined,
        bumpVersion: 'patch',
        manager: 'npm',
      });
      npm.updateDependency.mockReturnValue('old version');
      npm.bumpPackageVersion.mockReturnValue({ bumpedContent: 'new version' });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('bumps versions in autoReplace managers', async () => {
      config.upgrades.push({
        branchName: undefined,
        bumpVersion: 'patch',
        manager: 'helmv3',
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('version: 0.0.1');
      helmv3.bumpPackageVersion.mockReturnValue({
        bumpedContent: 'version: 0.0.2',
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
  });
});
