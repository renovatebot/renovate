const {
  getManagerPackageFiles,
} = require('../../../../lib/workers/repository/extract/manager-files');
/** @type any */
const fileMatch = require('../../../../lib/workers/repository/extract/file-match');
/** @type any */
const npm = require('../../../../lib/manager/npm');
/** @type any */
const dockerfile = require('../../../../lib/manager/dockerfile');

jest.mock('../../../../lib/workers/repository/extract/file-match');
jest.mock('../../../../lib/manager/dockerfile');

/** @type any */
const platform = global.platform;

describe('workers/repository/extract/manager-files', () => {
  describe('getManagerPackageFiles()', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = { ...require('../../../config/config/_fixtures') };
    });
    it('returns empty of manager is disabled', async () => {
      const managerConfig = { manager: 'travis', enabled: false };
      const res = await getManagerPackageFiles(config, managerConfig);
      expect(res).toHaveLength(0);
    });
    it('returns empty of manager is not enabled', async () => {
      config.enabledManagers = ['npm'];
      const managerConfig = { manager: 'docker', enabled: true };
      const res = await getManagerPackageFiles(config, managerConfig);
      expect(res).toHaveLength(0);
    });
    it('skips files if null content returned', async () => {
      const managerConfig = { manager: 'npm', enabled: true };
      fileMatch.getMatchingFiles.mockReturnValue(['package.json']);
      const res = await getManagerPackageFiles(config, managerConfig);
      expect(res).toHaveLength(0);
    });
    it('returns files with extractPackageFile', async () => {
      const managerConfig = { manager: 'dockerfile', enabled: true };
      fileMatch.getMatchingFiles.mockReturnValue(['Dockerfile']);
      platform.getFile.mockReturnValue('some content');
      dockerfile.extractPackageFile = jest.fn(() => ({ some: 'result' }));
      const res = await getManagerPackageFiles(config, managerConfig);
      expect(res).toMatchSnapshot();
    });
    it('returns files with extractAllPackageFiles', async () => {
      const managerConfig = { manager: 'npm', enabled: true };
      fileMatch.getMatchingFiles.mockReturnValue(['package.json']);
      platform.getFile.mockReturnValue('{}');
      npm.extractPackageFile = jest.fn(() => ({ some: 'result' }));
      const res = await getManagerPackageFiles(config, managerConfig);
      expect(res).toMatchSnapshot();
    });
  });
});
