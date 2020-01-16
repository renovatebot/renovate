import * as _composer from '../../../lib/manager/composer';
import * as _npm from '../../../lib/manager/npm';
import * as _gitSubmodules from '../../../lib/manager/git-submodules';
import { getUpdatedPackageFiles } from '../../../lib/workers/branch/get-updated';
import { mocked, defaultConfig, platform } from '../../util';
import {
  MANAGER_COMPOSER,
  MANAGER_GIT_SUBMODULES,
  MANAGER_NPM,
} from '../../../lib/constants/managers';
import { DATASOURCE_GIT_SUBMODULES } from '../../../lib/constants/data-binary-source';

const composer = mocked(_composer);
const gitSubmodules = mocked(_gitSubmodules);
const npm = mocked(_npm);

jest.mock('../../../lib/manager/composer');
jest.mock('../../../lib/manager/npm');
jest.mock('../../../lib/manager/git-submodules');

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
    it('handles empty', async () => {
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles null content', async () => {
      config.parentBranch = 'some-branch';
      config.upgrades.push({
        manager: MANAGER_NPM,
      });
      await expect(getUpdatedPackageFiles(config)).rejects.toThrow();
    });
    it('handles content change', async () => {
      config.parentBranch = 'some-branch';
      config.upgrades.push({
        manager: MANAGER_NPM,
      });
      npm.updateDependency.mockReturnValue('some new content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles lock files', async () => {
      config.parentBranch = 'some-branch';
      config.upgrades.push({
        manager: MANAGER_COMPOSER,
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
        manager: MANAGER_COMPOSER,
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
        manager: MANAGER_COMPOSER,
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
        manager: MANAGER_COMPOSER,
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
        manager: MANAGER_GIT_SUBMODULES,
        datasource: DATASOURCE_GIT_SUBMODULES,
      });
      gitSubmodules.updateDependency.mockResolvedValueOnce('existing content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
  });
});
