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
      expect(res.packageFiles).toMatchSnapshot();
    });
    it('uses packageFiles if already configured and raises error if not found', async () => {
      config.packageFiles = [
        'package.json',
        { packageFile: 'backend/package.json' },
      ];
      const res = await resolvePackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.errors).toHaveLength(2);
    });
    it('detect package.json and adds error if cannot parse (onboarding)', async () => {
      manager.detectPackageFiles = jest.fn(() => [
        { packageFile: 'package.json' },
      ]);
      platform.getFile.mockReturnValueOnce('not json');
      const res = await resolvePackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.errors).toHaveLength(1);
    });
    it('detect package.json and throws error if cannot parse (onboarded)', async () => {
      manager.detectPackageFiles = jest.fn(() => [
        { packageFile: 'package.json' },
      ]);
      platform.getFile.mockReturnValueOnce('not json');
      config.repoIsOnboarded = true;
      let e;
      try {
        await resolvePackageFiles(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e).toMatchSnapshot();
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
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.warnings).toHaveLength(0);
    });
    it('detects accompanying files', async () => {
      manager.detectPackageFiles = jest.fn(() => [
        { packageFile: 'package.json' },
      ]);
      platform.getFileList.mockReturnValueOnce([
        'yarn.lock',
        'package-lock.json',
        'shrinkwrap.yaml',
      ]);
      platform.getFile.mockReturnValueOnce('{"name": "package.json"}');
      platform.getFile.mockReturnValueOnce('npmrc');
      platform.getFile.mockReturnValueOnce('yarnrc');
      const res = await resolvePackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
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
      expect(res.packageFiles).toMatchSnapshot();
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
      expect(res.packageFiles).toMatchSnapshot();
    });
    it('applies package rules', async () => {
      config.pathRules = [
        {
          paths: ['examples/**'],
          prTitle: 'abcdefg',
        },
      ];
      config.packageFiles = [
        'package.json',
        'examples/a/package.json',
        'packages/examples/package.json',
      ];
      platform.getFileList.mockReturnValue([
        'package.json',
        'examples/a/package.json',
        'packages/examples/package.json',
      ]);
      platform.getFile.mockReturnValue('{}');
      const res = await resolvePackageFiles(config);
      expect(res.packageFiles).toHaveLength(3);
      expect(res.packageFiles[0].prTitle).not.toEqual('abcdefg');
      expect(res.packageFiles[1].prTitle).toEqual('abcdefg');
      expect(res.packageFiles[2].prTitle).not.toEqual('abcdefg');
    });
  });
});
