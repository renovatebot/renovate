const defaultConfig = require('../../lib/config/defaults').getConfig();
const manager = require('../../lib/manager');
const npmUpdater = require('../../lib/manager/npm/update');
const meteorUpdater = require('../../lib/manager/meteor/update');
const dockerUpdater = require('../../lib/manager/docker/update');

const { getUpdatedPackageFiles } = manager;

describe('manager', () => {
  describe('detectPackageFiles(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        warnings: [],
      };
    });
    it('adds package files to object', async () => {
      platform.getFileList.mockReturnValueOnce([
        'package.json',
        'backend/package.json',
      ]);
      const res = await manager.detectPackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });
    it('finds meteor package files', async () => {
      config.meteor.enabled = true;
      platform.getFileList.mockReturnValueOnce([
        'modules/something/package.js',
      ]); // meteor
      platform.getFile.mockReturnValueOnce('Npm.depends( {} )');
      const res = await manager.detectPackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
    it('skips meteor package files with no json', async () => {
      config.meteor.enabled = true;
      platform.getFileList.mockReturnValueOnce([
        'modules/something/package.js',
      ]); // meteor
      platform.getFile.mockReturnValueOnce('Npm.depends(packages)');
      const res = await manager.detectPackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(0);
    });
    it('finds Dockerfiles', async () => {
      platform.getFileList.mockReturnValueOnce([
        'Dockerfile',
        'other/Dockerfile',
      ]);
      platform.getFile.mockReturnValueOnce(
        '### comment\nFROM something\nRUN something'
      );
      platform.getFile.mockReturnValueOnce(
        'ARG foo\nFROM something\nRUN something'
      );
      const res = await manager.detectPackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
    it('skips Dockerfiles with no content', async () => {
      platform.getFileList.mockReturnValueOnce(['Dockerfile']);
      platform.getFile.mockReturnValueOnce(null);
      const res = await manager.detectPackageFiles(config);
      expect(res).toHaveLength(0);
    });
    it('ignores node modules', async () => {
      platform.getFileList.mockReturnValueOnce([
        'package.json',
        'node_modules/backend/package.json',
      ]);
      const res = await manager.detectPackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res.foundIgnoredPaths).toMatchSnapshot();
      expect(res.warnings).toMatchSnapshot();
    });
  });
  describe('getUpdatedPackageFiles', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        parentBranch: 'some-branch',
      };
      npmUpdater.setNewValue = jest.fn();
      dockerUpdater.setNewValue = jest.fn();
      meteorUpdater.setNewValue = jest.fn();
    });
    it('returns empty if lock file maintenance', async () => {
      config.upgrades = [{ type: 'lockFileMaintenance' }];
      const res = await getUpdatedPackageFiles(config);
      expect(res.updatedPackageFiles).toHaveLength(0);
    });
    it('recurses if setNewValue error', async () => {
      config.parentBranch = 'some-branch';
      config.canRebase = true;
      config.upgrades = [{ packageFile: 'package.json' }];
      npmUpdater.setNewValue.mockReturnValueOnce(null);
      npmUpdater.setNewValue.mockReturnValueOnce('some content');
      const res = await getUpdatedPackageFiles(config);
      expect(res.updatedPackageFiles).toHaveLength(1);
    });
    it('errors if cannot rebase', async () => {
      config.upgrades = [{ packageFile: 'package.json' }];
      let e;
      try {
        await getUpdatedPackageFiles(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });
    it('returns updated files', async () => {
      config.parentBranch = 'some-branch';
      config.canRebase = true;
      config.upgrades = [
        { packageFile: 'package.json' },
        { packageFile: 'Dockerfile' },
        { packageFile: 'packages/foo/package.js' },
      ];
      platform.getFile.mockReturnValueOnce('old content 1');
      platform.getFile.mockReturnValueOnce('old content 1');
      platform.getFile.mockReturnValueOnce('old content 2');
      platform.getFile.mockReturnValueOnce('old content 3');
      npmUpdater.setNewValue.mockReturnValueOnce('new content 1');
      npmUpdater.setNewValue.mockReturnValueOnce('new content 1+');
      dockerUpdater.setNewValue.mockReturnValueOnce('new content 2');
      meteorUpdater.setNewValue.mockReturnValueOnce('old content 3');
      const res = await getUpdatedPackageFiles(config);
      expect(res.updatedPackageFiles).toHaveLength(2);
    });
  });
});
