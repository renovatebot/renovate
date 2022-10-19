import { getConfig, git, mocked } from '../../../../../test/util';
import { GitRefsDatasource } from '../../../../modules/datasource/git-refs';
import * as _composer from '../../../../modules/manager/composer';
import * as _gitSubmodules from '../../../../modules/manager/git-submodules';
import * as _helmv3 from '../../../../modules/manager/helmv3';
import * as _npm from '../../../../modules/manager/npm';
import * as _terraform from '../../../../modules/manager/terraform';
import type { BranchConfig } from '../../../types';
import * as _autoReplace from './auto-replace';
import { getUpdatedPackageFiles } from './get-updated';

const composer = mocked(_composer);
const gitSubmodules = mocked(_gitSubmodules);
const helmv3 = mocked(_helmv3);
const npm = mocked(_npm);
const terraform = mocked(_terraform);
const autoReplace = mocked(_autoReplace);

jest.mock('../../../../modules/manager/composer');
jest.mock('../../../../modules/manager/helmv3');
jest.mock('../../../../modules/manager/npm');
jest.mock('../../../../modules/manager/git-submodules');
jest.mock('../../../../modules/manager/terraform');
jest.mock('../../../../util/git');
jest.mock('./auto-replace');

describe('workers/repository/update/branch/get-updated', () => {
  describe('getUpdatedPackageFiles()', () => {
    let config: BranchConfig;

    beforeEach(() => {
      // TODO: incompatible types (#7154)
      config = {
        ...getConfig(),
        upgrades: [],
      } as BranchConfig;
      npm.updateDependency = jest.fn();
      git.getFile.mockResolvedValueOnce('existing content');
    });

    it('handles autoreplace base updated', async () => {
      config.upgrades.push({
        packageFile: 'index.html',
        manager: 'html',
        branchName: '',
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('updated-file');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          { type: 'addition', path: 'index.html', contents: 'updated-file' },
        ],
      });
    });

    it('handles autoreplace branch no update', async () => {
      config.upgrades.push({
        packageFile: 'index.html',
        manager: 'html',
        branchName: '',
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('existing content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toEqual({
        artifactErrors: [],
        reuseExistingBranch: undefined,
        updatedArtifacts: [],
        updatedPackageFiles: [],
      });
    });

    it('handles autoreplace failure', async () => {
      config.upgrades.push({ manager: 'html', branchName: '' });
      autoReplace.doAutoReplace.mockResolvedValueOnce(null);
      await expect(getUpdatedPackageFiles(config)).rejects.toThrow();
    });

    it('handles autoreplace branch needs update', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        packageFile: 'index.html',
        manager: 'html',
        branchName: '',
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce(null);
      autoReplace.doAutoReplace.mockResolvedValueOnce('updated-file');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          { type: 'addition', path: 'index.html', contents: 'updated-file' },
        ],
      });
    });

    it('handles empty', async () => {
      const res = await getUpdatedPackageFiles(config);
      expect(res).toEqual({
        artifactErrors: [],
        reuseExistingBranch: undefined,
        updatedArtifacts: [],
        updatedPackageFiles: [],
      });
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
        packageFile: 'package.json',
        manager: 'npm',
      } as never);
      npm.updateDependency.mockReturnValue('some new content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'package.json',
            contents: 'some new content',
          },
        ],
      });
    });

    it('handles lock files', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('some new content');
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.json',
            contents: 'some contents',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'composer.json',
            contents: 'some contents',
          },
        ],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'composer.json',
            contents: 'some new content',
          },
        ],
      });
    });

    it('handles lockFileMaintenance', async () => {
      config.upgrades.push({
        manager: 'composer',
        updateType: 'lockFileMaintenance',
      } as never);
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.json',
            contents: 'some contents',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'composer.json',
            contents: 'some contents',
          },
        ],
      });
    });

    it('handles isRemediation success', async () => {
      config.upgrades.push({
        manager: 'npm',
        lockFile: 'package-lock.json',
        isRemediation: true,
      } as never);
      npm.updateLockedDependency.mockResolvedValueOnce({
        status: 'updated',
        files: { 'package-lock.json': 'new contents' },
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'package-lock.json',
            contents: 'new contents',
          },
        ],
      });
    });

    it('handles unsupported isRemediation', async () => {
      config.upgrades.push({
        manager: 'npm',
        lockFile: 'package-lock.json',
        isRemediation: true,
      } as never);
      npm.updateLockedDependency.mockResolvedValueOnce({
        status: 'unsupported',
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchInlineSnapshot(`
        {
          "artifactErrors": [],
          "reuseExistingBranch": undefined,
          "updatedArtifacts": [],
          "updatedPackageFiles": [],
        }
      `);
    });

    it('handles isRemediation rebase', async () => {
      config.upgrades.push({
        manager: 'npm',
        isRemediation: true,
      } as never);
      config.reuseExistingBranch = true;
      git.getFile.mockResolvedValueOnce('existing content');
      npm.updateLockedDependency.mockResolvedValue({
        status: 'updated',
        files: { 'package-lock.json': 'new contents' },
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'package-lock.json',
            contents: 'new contents',
          },
        ],
      });
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
      expect(res).toMatchSnapshot({
        artifactErrors: [{ lockFile: 'composer.lock', stderr: 'some error' }],
      });
    });

    it('handles lock file errors', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        manager: 'composer',
        branchName: '',
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
      expect(res).toMatchSnapshot({
        artifactErrors: [{ lockFile: 'composer.lock', stderr: 'some error' }],
      });
    });

    it('handles git submodules', async () => {
      config.upgrades.push({
        packageFile: '.gitmodules',
        manager: 'git-submodules',
        datasource: GitRefsDatasource.id,
      } as never);
      gitSubmodules.updateDependency.mockResolvedValueOnce('existing content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: '.gitmodules',
            contents: 'existing content',
          },
        ],
      });
    });

    it('update artifacts on update-lockfile strategy', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: '',
        isLockfileUpdate: true,
      });
      composer.updateLockedDependency.mockReturnValueOnce({
        status: 'unsupported',
      });
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'composer.lock',
            contents: 'some contents',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'composer.lock',
            contents: 'some contents',
          },
        ],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'composer.json',
            contents: 'existing content',
          },
        ],
      });
    });

    it('update artifacts on update-lockfile strategy with no updateLockedDependency', async () => {
      config.upgrades.push({
        packageFile: 'abc.tf',
        manager: 'terraform',
        branchName: '',
        isLockfileUpdate: true,
      });
      terraform.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'terraform.lock',
            contents: 'some contents',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'terraform.lock',
            contents: 'some contents',
          },
        ],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'abc.tf',
            contents: 'existing content',
          },
        ],
      });
    });

    it('attempts updateLockedDependency and handles unsupported', async () => {
      config.upgrades.push({
        packageFile: 'package.json',
        lockFiles: ['package-lock.json'],
        manager: 'npm',
        branchName: '',
        isLockfileUpdate: true,
      });
      npm.updateLockedDependency.mockResolvedValue({
        status: 'unsupported',
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchInlineSnapshot(`
        {
          "artifactErrors": [],
          "reuseExistingBranch": undefined,
          "updatedArtifacts": [],
          "updatedPackageFiles": [],
        }
      `);
    });

    it('attempts updateLockedDependency and handles already-updated', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        packageFile: 'package.json',
        lockFile: 'package-lock.json',
        manager: 'npm',
        branchName: '',
        isLockfileUpdate: true,
      });
      npm.updateLockedDependency.mockResolvedValueOnce({
        status: 'already-updated',
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchInlineSnapshot(`
        {
          "artifactErrors": [],
          "reuseExistingBranch": false,
          "updatedArtifacts": [],
          "updatedPackageFiles": [],
        }
      `);
    });

    it('attempts updateLockedDependency and handles updated files with reuse branch', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        packageFile: 'package.json',
        lockFile: 'package-lock.json',
        manager: 'npm',
        branchName: '',
        isLockfileUpdate: true,
      });
      git.getFile.mockResolvedValue('some content');
      npm.updateLockedDependency.mockResolvedValue({
        status: 'updated',
        files: {},
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchInlineSnapshot(`
        {
          "artifactErrors": [],
          "reuseExistingBranch": false,
          "updatedArtifacts": [],
          "updatedPackageFiles": [],
        }
      `);
    });

    it('bumps versions in updateDependency managers', async () => {
      config.upgrades.push({
        packageFile: 'package.json',
        branchName: '',
        bumpVersion: 'patch',
        manager: 'npm',
      });
      npm.updateDependency.mockReturnValue('old version');
      npm.bumpPackageVersion.mockReturnValue({ bumpedContent: 'new version' });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'package.json',
            contents: 'new version',
          },
        ],
      });
    });

    it('bumps versions in autoReplace managers', async () => {
      config.upgrades.push({
        packageFile: 'Chart.yaml',
        branchName: '',
        bumpVersion: 'patch',
        manager: 'helmv3',
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('version: 0.0.1');
      helmv3.bumpPackageVersion.mockReturnValue({
        bumpedContent: 'version: 0.0.2',
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'Chart.yaml',
            contents: 'version: 0.0.2',
          },
        ],
      });
    });
  });
});
