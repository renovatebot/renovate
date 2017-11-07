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
      platform.getFileContent.mockReturnValueOnce('not json');
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
      platform.getFileContent.mockReturnValueOnce(JSON.stringify(pJson));
      const res = await resolvePackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res.warnings).toHaveLength(0);
    });
    it('downloads accompanying files', async () => {
      manager.detectPackageFiles = jest.fn(() => [
        { packageFile: 'package.json' },
      ]);
      platform.getFileContent.mockReturnValueOnce('{"name": "package.json"}');
      platform.getFileContent.mockReturnValueOnce('npmrc');
      platform.getFileContent.mockReturnValueOnce('yarnrc');
      platform.getFileContent.mockReturnValueOnce('# yarn.lock');
      platform.getFileContent.mockReturnValueOnce(
        '{"name": "packge-lock.json"}'
      );
      const res = await resolvePackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res.warnings).toHaveLength(0);
    });
    it('detects meteor and docker', async () => {
      config.packageFiles = ['package.js', 'Dockerfile'];
      platform.getFileContent.mockReturnValueOnce('# comment\nFROM node:8\n'); // Dockerfile
      const res = await resolvePackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('skips docker if no content or no match', async () => {
      config.packageFiles = ['Dockerfile', 'other/Dockerfile'];
      platform.getFileContent.mockReturnValueOnce('# comment\n'); // Dockerfile
      const res = await resolvePackageFiles(config);
      expect(res).toMatchSnapshot();
    });
  });
});
