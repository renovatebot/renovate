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
    beforeEach(() => {
      manager.detectPackageFiles = jest.fn();
    });
    it('detect package.json and adds error if cannot parse (onboarding)', async () => {
      manager.detectPackageFiles.mockReturnValueOnce([
        { packageFile: 'package.json', manager: 'npm' },
      ]);
      platform.getFileList.mockReturnValueOnce(['package.json']);
      platform.getFile.mockReturnValueOnce('not json');
      const res = await resolvePackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.errors).toHaveLength(1);
    });
    it('detect package.json and throws error if cannot parse (onboarded)', async () => {
      manager.detectPackageFiles.mockReturnValueOnce([
        { packageFile: 'package.json', manager: 'npm' },
      ]);
      platform.getFileList.mockReturnValueOnce(['package.json']);
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
      manager.detectPackageFiles.mockReturnValueOnce([
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
      platform.getFileList.mockReturnValueOnce(['package.json']);
      platform.getFileList.mockReturnValueOnce(['package.json']);
      const res = await resolvePackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.warnings).toHaveLength(0);
    });
    it('detects accompanying files', async () => {
      manager.detectPackageFiles.mockReturnValueOnce([
        { packageFile: 'package.json', manager: 'npm' },
      ]);
      platform.getFileList.mockReturnValue([
        'package.json',
        'yarn.lock',
        'package-lock.json',
        'npm-shrinkwrap.json',
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
    it('resolves docker', async () => {
      platform.getFileList.mockReturnValue(['Dockerfile']);
      platform.getFile.mockReturnValue('# comment\nFROM node:8\n'); // Dockerfile
      const res = await resolvePackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.packageFiles).toHaveLength(1);
      expect(res.warnings).toHaveLength(0);
    });
    it('resolves package files without own resolve', async () => {
      platform.getFileList.mockReturnValue(['WORKSPACE']);
      platform.getFile.mockReturnValue('git_repository(\n'); // WORKSPACE
      const res = await resolvePackageFiles(config);
      expect(res.packageFiles).toMatchSnapshot();
      expect(res.packageFiles).toHaveLength(1);
      expect(res.warnings).toHaveLength(0);
    });
    it('strips npmrc with NPM_TOKEN', async () => {
      manager.detectPackageFiles.mockReturnValueOnce([
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
    it('checks if renovate config in nested package.json throws an error', async () => {
      manager.detectPackageFiles.mockReturnValueOnce([
        { packageFile: 'package.json', manager: 'npm' },
      ]);
      platform.getFileList.mockReturnValue(['test/package.json']);
      platform.getFile.mockReturnValueOnce(
        '{"name": "test/package.json", "version": "0.0.1", "renovate":{"enabled": true}}'
      );
      let e;
      try {
        await resolvePackageFiles(config);
      } catch (err) {
        e = err;
      }
      expect(e).toEqual(new Error('config-validation'));
    });
  });
});
