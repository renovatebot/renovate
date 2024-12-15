import {
  createAquaToolConfig,
  createCargoToolConfig,
  createGoToolConfig,
  createNpmToolConfig,
  createPipxToolConfig,
  createSpmToolConfig,
  createUbiToolConfig,
} from './backends';

describe('modules/manager/mise/backends', () => {
  describe('createAquaToolConfig()', () => {
    it('should create a tooling config', () => {
      expect(createAquaToolConfig('BurntSushi/ripgrep')).toEqual({
        packageName: 'BurntSushi/ripgrep',
        datasource: 'github-tags',
      });
    });
  });

  describe('createCargoToolConfig()', () => {
    it('should create a tooling config for crate', () => {
      expect(createCargoToolConfig('eza', '')).toEqual({
        packageName: 'eza',
        datasource: 'crate',
      });
    });

    it('should create a tooling config for git tag', () => {
      expect(
        createCargoToolConfig('https://github.com/username/demo', 'tag:v0.1.0'),
      ).toEqual({
        packageName: 'https://github.com/username/demo',
        currentValue: 'v0.1.0',
        datasource: 'git-tags',
      });
    });

    it('should provide skipReason for git branch', () => {
      expect(
        createCargoToolConfig(
          'https://github.com/username/demo',
          'branch:main',
        ),
      ).toEqual({
        packageName: 'https://github.com/username/demo',
        skipReason: 'unsupported-version',
      });
    });

    it('should create a tooling config for git rev', () => {
      expect(
        createCargoToolConfig('https://github.com/username/demo', 'rev:abcdef'),
      ).toEqual({
        packageName: 'https://github.com/username/demo',
        currentValue: 'abcdef',
        datasource: 'git-refs',
      });
    });

    it('should provide skipReason for invalid version', () => {
      expect(
        createCargoToolConfig('https://github.com/username/demo', 'v0.1.0'),
      ).toEqual({
        packageName: 'https://github.com/username/demo',
        skipReason: 'invalid-version',
      });
    });
  });

  describe('createGoToolConfig()', () => {
    it('should create a tooling config', () => {
      expect(createGoToolConfig('github.com/DarthSim/hivemind')).toEqual({
        packageName: 'github.com/DarthSim/hivemind',
        datasource: 'go',
      });
    });
  });

  describe('createNpmToolConfig()', () => {
    it('should create a tooling config', () => {
      expect(createNpmToolConfig('prettier')).toEqual({
        packageName: 'prettier',
        datasource: 'npm',
      });
    });
  });

  describe('createPipxToolConfig()', () => {
    it('should create a tooling config for pypi package', () => {
      expect(createPipxToolConfig('yamllint')).toEqual({
        packageName: 'yamllint',
        datasource: 'pypi',
      });
    });

    it('should create a tooling config for github shorthand', () => {
      expect(createPipxToolConfig('psf/black')).toEqual({
        packageName: 'psf/black',
        datasource: 'github-tags',
      });
    });

    it('should create a tooling config for github url', () => {
      expect(
        createPipxToolConfig('git+https://github.com/psf/black.git'),
      ).toEqual({
        packageName: 'psf/black',
        datasource: 'github-tags',
      });
    });

    it('should create a tooling config for git url', () => {
      expect(
        createPipxToolConfig('git+https://gitlab.com/user/repo.git'),
      ).toEqual({
        packageName: 'https://gitlab.com/user/repo',
        datasource: 'git-refs',
      });
    });

    it('provides skipReason for zip file url', () => {
      expect(
        createPipxToolConfig('https://github.com/psf/black/archive/18.9b0.zip'),
      ).toEqual({
        packageName: 'https://github.com/psf/black/archive/18.9b0.zip',
        skipReason: 'unsupported-url',
      });
    });
  });

  describe('createSpmToolConfig()', () => {
    it('should create a tooling config for github shorthand', () => {
      expect(createSpmToolConfig('tuist/tuist')).toEqual({
        packageName: 'tuist/tuist',
        datasource: 'github-releases',
      });
    });

    it('should create a tooling config for github url', () => {
      expect(createSpmToolConfig('https://github.com/tuist/tuist.git')).toEqual(
        {
          packageName: 'tuist/tuist',
          datasource: 'github-releases',
        },
      );
    });

    it('provides skipReason for other url', () => {
      expect(createSpmToolConfig('https://gitlab.com/user/repo.git')).toEqual({
        packageName: 'https://gitlab.com/user/repo.git',
        skipReason: 'unsupported-url',
      });
    });
  });

  describe('createUbiToolConfig()', () => {
    it('should create a tooling config with empty options', () => {
      expect(createUbiToolConfig('nekto/act', {})).toEqual({
        packageName: 'nekto/act',
        datasource: 'github-releases',
      });
    });

    it('should ignore options unless tag_regex is provided', () => {
      expect(createUbiToolConfig('cli/cli', { exe: 'gh' } as any)).toEqual({
        packageName: 'cli/cli',
        datasource: 'github-releases',
      });
    });

    it('should set extractVersion if tag_regex is provided', () => {
      expect(
        createUbiToolConfig('cargo-bins/cargo-binstall', {
          tag_regex: '^\\d+\\.\\d+\\.',
        }),
      ).toEqual({
        packageName: 'cargo-bins/cargo-binstall',
        datasource: 'github-releases',
        extractVersion: '(?<version>^\\d+\\.\\d+\\.)',
      });
    });
  });
});
