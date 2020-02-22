import * as _composer from '../../../lib/manager/composer';
import * as _npm from '../../../lib/manager/npm';
import * as _gitSubmodules from '../../../lib/manager/git-submodules';
import * as _autoReplace from '../../../lib/workers/branch/auto-replace';
import { getUpdatedPackageFiles } from '../../../lib/workers/branch/get-updated';
import { mocked, defaultConfig, platform } from '../../util';
import { DATASOURCE_GIT_SUBMODULES } from '../../../lib/constants/data-binary-source';

const composer = mocked(_composer);
const gitSubmodules = mocked(_gitSubmodules);
const npm = mocked(_npm);
const autoReplace = mocked(_autoReplace);

jest.mock('../../../lib/manager/composer');
jest.mock('../../../lib/manager/npm');
jest.mock('../../../lib/manager/git-submodules');
jest.mock('../../../lib/workers/branch/auto-replace');

describe('workers/branch/get-updated', () => {
  describe('getUpdatedPackageFiles()', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        upgrades: [],
      };
      npm.updateDependency = jest.fn();
      platform.getFile.mockResolvedValueOnce('existing content');
    });
    it('handles autoreplace base updated', async () => {
      config.upgrades.push({ manager: 'html', autoReplace: true });
      autoReplace.doAutoReplace.mockResolvedValueOnce('updated-file');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles autoreplace branch no update', async () => {
      config.upgrades.push({ manager: 'html', autoReplace: true });
      autoReplace.doAutoReplace.mockResolvedValueOnce('existing content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles autoreplace failure', async () => {
      config.upgrades.push({ manager: 'html', autoReplace: true });
      autoReplace.doAutoReplace.mockResolvedValueOnce(null);
      await expect(getUpdatedPackageFiles(config)).rejects.toThrow();
    });
    it('handles autoreplace branch needs update', async () => {
      config.parentBranch = 'some branch';
      config.upgrades.push({ manager: 'html', autoReplace: true });
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
      config.parentBranch = 'some-branch';
      config.upgrades.push({
        manager: 'npm',
      });
      await expect(getUpdatedPackageFiles(config)).rejects.toThrow();
    });
    it('handles content change', async () => {
      config.parentBranch = 'some-branch';
      config.upgrades.push({
        manager: 'npm',
      });
      npm.updateDependency.mockReturnValue('some new content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles lock files', async () => {
      config.parentBranch = 'some-branch';
      config.upgrades.push({
        manager: 'composer',
      });
      composer.updateDependency.mockReturnValue('some new content');
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
      // config.parentBranch = 'some-branch';
      config.upgrades.push({
        manager: 'composer',
        updateType: 'lockFileMaintenance',
      });
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
      // config.parentBranch = 'some-branch';
      config.upgrades.push({
        manager: 'composer',
        updateType: 'lockFileMaintenance',
      });
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
      config.parentBranch = 'some-branch';
      config.upgrades.push({
        manager: 'composer',
      });
      composer.updateDependency.mockReturnValue('some new content');
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
        datasource: DATASOURCE_GIT_SUBMODULES,
      });
      gitSubmodules.updateDependency.mockResolvedValueOnce('existing content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
  });
});
