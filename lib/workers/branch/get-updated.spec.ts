import { defaultConfig, git, mocked } from '../../../test/util';
import { GitRefsDatasource } from '../../datasource/git-refs';
import * as _composer from '../../manager/composer';
import * as _gitSubmodules from '../../manager/git-submodules';
import * as _helmv3 from '../../manager/helmv3';
import * as _npm from '../../manager/npm';
import * as _poetry from '../../manager/poetry';
import type { BranchConfig } from '../types';
import * as _autoReplace from './auto-replace';
import { getUpdatedPackageFiles } from './get-updated';

const composer = mocked(_composer);
const gitSubmodules = mocked(_gitSubmodules);
const helmv3 = mocked(_helmv3);
const npm = mocked(_npm);
const poetry = mocked(_poetry);
const autoReplace = mocked(_autoReplace);

jest.mock('../../manager/composer');
jest.mock('../../manager/helmv3');
jest.mock('../../manager/npm');
jest.mock('../../manager/git-submodules');
jest.mock('../../manager/poetry');
jest.mock('../../util/git');
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
      git.getFile.mockResolvedValueOnce('existing content');
    });
    it('handles autoreplace base updated', async () => {
      config.upgrades.push({
        packageFile: 'index.html',
        manager: 'html',
        branchName: undefined,
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce('updated-file');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [{ name: 'index.html', contents: 'updated-file' }],
      });
    });
    it('handles autoreplace branch no update', async () => {
      config.upgrades.push({
        packageFile: 'index.html',
        manager: 'html',
        branchName: undefined,
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
      config.upgrades.push({ manager: 'html', branchName: undefined });
      autoReplace.doAutoReplace.mockResolvedValueOnce(null);
      await expect(getUpdatedPackageFiles(config)).rejects.toThrow();
    });
    it('handles autoreplace branch needs update', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        packageFile: 'index.html',
        manager: 'html',
        branchName: undefined,
      });
      autoReplace.doAutoReplace.mockResolvedValueOnce(null);
      autoReplace.doAutoReplace.mockResolvedValueOnce('updated-file');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [{ contents: 'updated-file', name: 'index.html' }],
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
          { name: 'package.json', contents: 'some new content' },
        ],
      });
    });
    it('handles lock files', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        packageFile: 'composer.json',
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
      expect(res).toMatchSnapshot({
        updatedArtifacts: [
          { name: 'composer.json', contents: 'some contents' },
        ],
        updatedPackageFiles: [
          { name: 'composer.json', contents: 'some new content' },
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
            name: 'composer.json',
            contents: 'some contents',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedArtifacts: [
          { name: 'composer.json', contents: 'some contents' },
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
          { name: 'package-lock.json', contents: 'new contents' },
        ],
      });
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
          { name: 'package-lock.json', contents: 'new contents' },
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
          { name: '.gitmodules', contents: 'existing content' },
        ],
      });
    });
    it('update artifacts on update-lockfile strategy', async () => {
      config.upgrades.push({
        packageFile: 'composer.json',
        manager: 'composer',
        branchName: undefined,
        isLockfileUpdate: true,
      });
      composer.updateLockedDependency.mockReturnValueOnce({
        status: 'unsupported',
      });
      composer.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            name: 'composer.lock',
            contents: 'some contents',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedArtifacts: [
          { name: 'composer.lock', contents: 'some contents' },
        ],
        updatedPackageFiles: [
          { name: 'composer.json', contents: 'existing content' },
        ],
      });
    });
    it('update artifacts on update-lockfile strategy with no updateLockedDependency', async () => {
      config.upgrades.push({
        packageFile: 'pyproject.toml',
        manager: 'poetry',
        branchName: undefined,
        isLockfileUpdate: true,
      });
      poetry.updateArtifacts.mockResolvedValueOnce([
        {
          file: {
            name: 'poetry.lock',
            contents: 'some contents',
          },
        },
      ]);
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedArtifacts: [{ name: 'poetry.lock', contents: 'some contents' }],
        updatedPackageFiles: [
          { name: 'pyproject.toml', contents: 'existing content' },
        ],
      });
    });
    it('attempts updateLockedDependency and handles unsupported', async () => {
      config.upgrades.push({
        packageFile: 'package.json',
        lockFiles: ['package-lock.json'],
        manager: 'npm',
        branchName: undefined,
        isLockfileUpdate: true,
      });
      npm.updateLockedDependency.mockResolvedValue({
        status: 'unsupported',
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchInlineSnapshot(`
        Object {
          "artifactErrors": Array [],
          "reuseExistingBranch": undefined,
          "updatedArtifacts": Array [],
          "updatedPackageFiles": Array [],
        }
      `);
    });
    it('attempts updateLockedDependency and handles already-updated', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        packageFile: 'package.json',
        lockFile: 'package-lock.json',
        manager: 'npm',
        branchName: undefined,
        isLockfileUpdate: true,
      });
      npm.updateLockedDependency.mockResolvedValueOnce({
        status: 'already-updated',
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchInlineSnapshot(`
        Object {
          "artifactErrors": Array [],
          "reuseExistingBranch": false,
          "updatedArtifacts": Array [],
          "updatedPackageFiles": Array [],
        }
      `);
    });
    it('attempts updateLockedDependency and handles updated files with reuse branch', async () => {
      config.reuseExistingBranch = true;
      config.upgrades.push({
        packageFile: 'package.json',
        lockFile: 'package-lock.json',
        manager: 'npm',
        branchName: undefined,
        isLockfileUpdate: true,
      });
      git.getFile.mockResolvedValue('some content');
      npm.updateLockedDependency.mockResolvedValue({
        status: 'updated',
        files: {},
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchInlineSnapshot(`
        Object {
          "artifactErrors": Array [],
          "reuseExistingBranch": false,
          "updatedArtifacts": Array [],
          "updatedPackageFiles": Array [],
        }
      `);
    });
    it('bumps versions in updateDependency managers', async () => {
      config.upgrades.push({
        packageFile: 'package.json',
        branchName: undefined,
        bumpVersion: 'patch',
        manager: 'npm',
      });
      npm.updateDependency.mockReturnValue('old version');
      npm.bumpPackageVersion.mockReturnValue({ bumpedContent: 'new version' });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot({
        updatedPackageFiles: [
          {
            name: 'package.json',
            contents: 'new version',
          },
        ],
      });
    });
    it('bumps versions in autoReplace managers', async () => {
      config.upgrades.push({
        packageFile: 'Chart.yaml',
        branchName: undefined,
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
            contents: 'version: 0.0.2',
            name: 'Chart.yaml',
          },
        ],
      });
    });
  });
});
