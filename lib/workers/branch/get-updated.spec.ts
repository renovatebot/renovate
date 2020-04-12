import * as _composer from '../../manager/composer';
import * as _npm from '../../manager/npm';
import * as _gitSubmodules from '../../manager/git-submodules';
import * as _autoReplace from './auto-replace';
import { getUpdatedPackageFiles } from './get-updated';
import { mocked, defaultConfig, platform } from '../../../test/util';
import * as datasourceGitSubmodules from '../../datasource/git-submodules';

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
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            name: 'composer.json',
            contents: 'some contents',
          },
        },
      ]);
      config.upgrades.forEach(upgrade => {
        upgrade.autoReplace = true; // eslint-disable-line no-param-reassign
      });
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
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          artifactError: {
            lockFile: 'composer.lock',
            stderr: 'some error',
          },
        },
      ]);
      config.upgrades.forEach(upgrade => {
        upgrade.autoReplace = true; // eslint-disable-line no-param-reassign
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles git submodules', async () => {
      config.upgrades.push({
        manager: 'git-submodules',
        datasource: datasourceGitSubmodules.id,
      });
      gitSubmodules.updateDependency.mockResolvedValueOnce('existing content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
  });
});
