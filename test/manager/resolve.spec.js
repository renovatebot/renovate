const manager = require('../../lib/manager');

const { resolvePackageFiles } = manager;

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = { ...require('../_fixtures/config') };
  config.global = {};
  config.errors = [];
  config.warnings = [];
});

describe('manager/resolve', () => {
  describe('resolvePackageFiles()', () => {
    it('handles wrong filenames', async () => {
      config.packageFiles = ['wrong.txt'];
      let e;
      try {
        await resolvePackageFiles(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
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
        { packageFile: 'package.json', manager: 'npm' },
      ]);
      platform.getFileList.mockReturnValue(['package.json']);
      platform.getFile.mockReturnValueOnce('not json');
      const res = await resolvePackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.errors).toHaveLength(1);
    });
    it('detect package.json and throws error if cannot parse (onboarded)', async () => {
      manager.detectPackageFiles = jest.fn(() => [
        { packageFile: 'package.json', manager: 'npm' },
      ]);
      platform.getFileList.mockReturnValue(['package.json']);
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
    it('clears npmrc and yarnrc fields', async () => {
      manager.detectPackageFiles = jest.fn(() => [
        { packageFile: 'package.json', manager: 'npm' },
      ]);
      const pJson = {
        name: 'something',
        version: '1.0.0',
        renovate: {
          automerge: true,
        },
      };
      platform.getFile.mockReturnValueOnce(JSON.stringify(pJson));
      platform.getFileList.mockReturnValue(['package.json']);
      const res = await resolvePackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.warnings).toHaveLength(0);
    });
    it('detects accompanying files', async () => {
      manager.detectPackageFiles = jest.fn(() => [
        { packageFile: 'package.json', manager: 'npm' },
      ]);
      platform.getFileList.mockReturnValue([
        'package.json',
        'yarn.lock',
        'package-lock.json',
        'shrinkwrap.yaml',
      ]);
      platform.getFile.mockReturnValueOnce(
        '{"name": "package.json", "version": "0.0.1"}'
      );
      platform.getFile.mockReturnValueOnce('npmrc');
      platform.getFile.mockReturnValueOnce('yarnrc');
      const res = await resolvePackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.warnings).toHaveLength(0);
    });
    it('detects meteor and docker and travis and bazel and nvm', async () => {
      config.packageFiles = [
        'package.js',
        'Dockerfile',
        '.travis.yml',
        'WORKSPACE',
        '.nvmrc',
      ];
      platform.getFile.mockReturnValueOnce('{}'); // package.js
      platform.getFile.mockReturnValueOnce('# comment\nFROM node:8\n'); // Dockerfile
      platform.getFile.mockReturnValueOnce('# travis'); // .travis.yml
      platform.getFile.mockReturnValueOnce('# WORKSPACE'); // Dockerfile
      platform.getFile.mockReturnValueOnce('8.9\n'); // Dockerfile
      const res = await resolvePackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
    });
    it('skips if no content or no match', async () => {
      config.packageFiles = [
        'Dockerfile',
        'other/Dockerfile',
        '.travis.yml',
        'WORKSPACE',
        'package.js',
        '.nvmrc',
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
    it('strips npmrc with NPM_TOKEN', async () => {
      manager.detectPackageFiles = jest.fn(() => [
        { packageFile: 'package.json', manager: 'npm' },
      ]);
      platform.getFileList.mockReturnValue(['package.json', '.npmrc']);
      platform.getFile.mockReturnValueOnce(
        '{"name": "package.json", "version": "0.0.1"}'
      );
      platform.getFile.mockReturnValueOnce(
        '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' // eslint-disable-line
      );
      const res = await resolvePackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.warnings).toHaveLength(0);
    });
  });
});
