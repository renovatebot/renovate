const {
  hasPackageLock,
  hasYarnLock,
  determineLockFileDirs,
  writeExistingFiles,
  writeUpdatedPackageFiles,
  getUpdatedFiles,
} = require('../../../lib/workers/branch/lock-files');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const logger = require('../../_fixtures/logger');

describe('workers/branch/lock-files', () => {
  describe('hasPackageLock', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        logger,
      };
    });
    it('returns true if found and true', async () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          hasPackageLock: true,
        },
      ];
      expect(hasPackageLock(config, 'package.json')).toBe(true);
    });
    it('returns false if found and false', async () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          hasPackageLock: true,
        },
        {
          packageFile: 'backend/package.json',
        },
      ];
      expect(hasPackageLock(config, 'backend/package.json')).toBe(false);
    });
    it('throws error if not found', async () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          hasPackageLock: true,
        },
        {
          packageFile: 'backend/package.json',
        },
      ];
      let e;
      try {
        hasPackageLock(config, 'frontend/package.json');
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });
  });
  describe('hasYarnLock', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        logger,
      };
    });
    it('returns true if found and true', async () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          hasYarnLock: true,
        },
      ];
      expect(hasYarnLock(config, 'package.json')).toBe(true);
    });
    it('returns false if found and false', async () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          hasYarnLock: true,
        },
        {
          packageFile: 'backend/package.json',
        },
      ];
      expect(hasYarnLock(config, 'backend/package.json')).toBe(false);
    });
    it('throws error if not found', async () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          hasYarnLock: true,
        },
        {
          packageFile: 'backend/package.json',
        },
      ];
      let e;
      try {
        hasYarnLock(config, 'frontend/package.json');
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });
  });
  describe('determineLockFileDirs', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        logger,
        packageFiles: [
          {
            packageFile: 'package.json',
            hasYarnLock: true,
          },
          {
            packageFile: 'backend/package.json',
            hasPackageLock: true,
          },
        ],
      };
    });
    it('returns all directories if lock file maintenance', () => {
      config.upgrades = [{ type: 'lockFileMaintenance' }];
      const res = determineLockFileDirs(config);
      expect(res).toMatchSnapshot();
    });
    it('returns directories from updated package files', () => {
      config.upgrades = [{}];
      config.updatedPackageFiles = [
        {
          name: 'package.json',
          contents: 'some contents',
        },
        {
          name: 'backend/package.json',
          contents: 'some contents',
        },
      ];
      const res = determineLockFileDirs(config);
      expect(res).toMatchSnapshot();
    });
  });
});
