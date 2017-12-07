const { resolvePackageFiles } = require('../../lib/manager/resolve');
const manager = require('../../lib/manager');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = { ...require('../_fixtures/config') };
  config.errors = [];
  config.warnings = [];
});

describe('manager/resolve', () => {
  describe('resolvePackageFiles()', () => {
    it('handles wrong filenames', async () => {
      config.packageFiles = ['wrong.txt'];
      const res = await resolvePackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('uses packageFiles if already configured and raises error if not found', async () => {
      config.packageFiles = [
        'package.json',
        { packageFile: 'backend/package.json' },
      ];
      const res = await resolvePackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res.errors).toHaveLength(2);
    });
    it('deetect package.json and warns if cannot parse', async () => {
      manager.detectPackageFiles = jest.fn(() => [
        { packageFile: 'package.json' },
      ]);
      platform.getFile.mockReturnValueOnce('not json');
      const res = await resolvePackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res.warnings).toHaveLength(1);
    });
    it('detects package.json and parses json with renovate config', async () => {
      manager.detectPackageFiles = jest.fn(() => [
        { packageFile: 'package.json' },
      ]);
      const pJson = {
        renovate: {
          automerge: true,
        },
      };
      platform.getFile.mockReturnValueOnce(JSON.stringify(pJson));
      platform.getFileList.mockReturnValueOnce([]);
      const res = await resolvePackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res.warnings).toHaveLength(0);
    });
    it('detects accompanying files', async () => {
      manager.detectPackageFiles = jest.fn(() => [
        { packageFile: 'package.json' },
      ]);
      platform.getFileList.mockReturnValueOnce([
        'yarn.lock',
        'package-lock.json',
      ]);
      platform.getFile.mockReturnValueOnce('{"name": "package.json"}');
      platform.getFile.mockReturnValueOnce('npmrc');
      platform.getFile.mockReturnValueOnce('yarnrc');
      const res = await resolvePackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res.warnings).toHaveLength(0);
    });
    it('detects meteor and docker and travis and bazel', async () => {
      config.packageFiles = [
        'package.js',
        'Dockerfile',
        '.travis.yml',
        'WORKSPACE',
      ];
      platform.getFile.mockReturnValueOnce('# comment\nFROM node:8\n'); // Dockerfile.js
      platform.getFile.mockReturnValueOnce('hello: world\n'); // Dockerfile
      platform.getFile.mockReturnValueOnce('# travis'); // .travis.yml
      platform.getFile.mockReturnValueOnce('# WORKSPACE'); // Dockerfile
      const res = await resolvePackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('skips if no content or no match', async () => {
      config.packageFiles = [
        'Dockerfile',
        'other/Dockerfile',
        '.travis.yml',
        'WORKSPACE',
      ];
      platform.getFile.mockReturnValueOnce('# comment\n'); // Dockerfile
      const res = await resolvePackageFiles(config);
      expect(res).toMatchSnapshot();
    });
  });
});
