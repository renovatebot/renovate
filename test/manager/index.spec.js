const logger = require('../_fixtures/logger');
const defaultConfig = require('../../lib/config/defaults').getConfig();
const manager = require('../../lib/manager');

describe('manager', () => {
  describe('detectPackageFiles(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        api: {
          getFileList: jest.fn(() => []),
          getFileContent: jest.fn(),
        },
        logger,
        warnings: [],
      };
    });
    it('adds package files to object', async () => {
      config.api.getFileList.mockReturnValueOnce([
        'package.json',
        'backend/package.json',
      ]);
      const res = await manager.detectPackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.packageFiles).toHaveLength(2);
    });
    it('finds meteor package files', async () => {
      config.meteor.enabled = true;
      config.api.getFileList.mockReturnValueOnce([
        'modules/something/package.js',
      ]); // meteor
      config.api.getFileContent.mockReturnValueOnce('Npm.depends( {} )');
      const res = await manager.detectPackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.packageFiles).toHaveLength(1);
    });
    it('skips meteor package files with no json', async () => {
      config.meteor.enabled = true;
      config.api.getFileList.mockReturnValueOnce([
        'modules/something/package.js',
      ]); // meteor
      config.api.getFileContent.mockReturnValueOnce('Npm.depends(packages)');
      const res = await manager.detectPackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.packageFiles).toHaveLength(0);
    });
    it('finds Dockerfiles', async () => {
      config.api.getFileList.mockReturnValueOnce([
        'Dockerfile',
        'other/Dockerfile',
      ]);
      config.api.getFileContent.mockReturnValueOnce(
        '### comment\nFROM something\nRUN something'
      );
      config.api.getFileContent.mockReturnValueOnce(
        'ARG foo\nFROM something\nRUN something'
      );
      const res = await manager.detectPackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.packageFiles).toHaveLength(1);
    });
    it('ignores node modules', async () => {
      config.api.getFileList.mockReturnValueOnce([
        'package.json',
        'node_modules/backend/package.json',
      ]);
      const res = await manager.detectPackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.packageFiles).toHaveLength(1);
      expect(res.foundIgnoredPaths).toMatchSnapshot();
      expect(res.warnings).toMatchSnapshot();
    });
  });
});
