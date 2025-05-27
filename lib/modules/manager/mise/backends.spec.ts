import {
  createAquaToolConfig,
  createCargoToolConfig,
  createDotnetToolConfig,
  createGemToolConfig,
  createGoToolConfig,
  createNpmToolConfig,
  createPipxToolConfig,
  createSpmToolConfig,
  createUbiToolConfig,
} from './backends';

describe('modules/manager/mise/backends', () => {
  describe('createAquaToolConfig()', () => {
    it('should create a tooling config', () => {
      expect(
        createAquaToolConfig('BurntSushi/ripgrep', '14.1.1'),
      ).toStrictEqual({
        packageName: 'BurntSushi/ripgrep',
        datasource: 'github-tags',
        currentValue: '14.1.1',
        extractVersion: '^v?(?<version>.+)',
      });
    });

    it('should trim the leading v from version', () => {
      expect(
        createAquaToolConfig('BurntSushi/ripgrep', 'v14.1.1'),
      ).toStrictEqual({
        packageName: 'BurntSushi/ripgrep',
        datasource: 'github-tags',
        currentValue: '14.1.1',
        extractVersion: '^v?(?<version>.+)',
      });
    });
  });

  describe('createCargoToolConfig()', () => {
    it('should create a tooling config for crate', () => {
      expect(createCargoToolConfig('eza', '')).toStrictEqual({
        packageName: 'eza',
        datasource: 'crate',
      });
    });

    it('should create a tooling config for git tag', () => {
      expect(
        createCargoToolConfig('https://github.com/username/demo', 'tag:v0.1.0'),
      ).toStrictEqual({
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
      ).toStrictEqual({
        packageName: 'https://github.com/username/demo',
        currentValue: 'main',
        datasource: 'git-refs',
      });
    });

    it('should create a tooling config for git rev', () => {
      expect(
        createCargoToolConfig('https://github.com/username/demo', 'rev:abcdef'),
      ).toStrictEqual({
        packageName: 'https://github.com/username/demo',
        currentValue: 'abcdef',
        datasource: 'git-refs',
      });
    });

    it('should provide skipReason for invalid version', () => {
      expect(
        createCargoToolConfig('https://github.com/username/demo', 'v0.1.0'),
      ).toStrictEqual({
        packageName: 'https://github.com/username/demo',
        skipReason: 'invalid-version',
      });
    });
  });

  describe('createDotnetToolConfig()', () => {
    it('should create a tooling config', () => {
      expect(createDotnetToolConfig('GitVersion.Tool')).toStrictEqual({
        packageName: 'GitVersion.Tool',
        datasource: 'nuget',
      });
    });
  });

  describe('createGemToolConfig()', () => {
    it('should create a tooling config', () => {
      expect(createGemToolConfig('rubocop')).toStrictEqual({
        packageName: 'rubocop',
        datasource: 'rubygems',
      });
    });
  });

  describe('createGoToolConfig()', () => {
    it('should create a tooling config', () => {
      expect(createGoToolConfig('github.com/DarthSim/hivemind')).toStrictEqual({
        packageName: 'github.com/DarthSim/hivemind',
        datasource: 'go',
      });
    });
  });

  describe('createNpmToolConfig()', () => {
    it('should create a tooling config', () => {
      expect(createNpmToolConfig('prettier')).toStrictEqual({
        packageName: 'prettier',
        datasource: 'npm',
      });
    });
  });

  describe('createPipxToolConfig()', () => {
    it('should create a tooling config for pypi package', () => {
      expect(createPipxToolConfig('yamllint')).toStrictEqual({
        packageName: 'yamllint',
        datasource: 'pypi',
      });
    });

    it('should create a tooling config for github shorthand', () => {
      expect(createPipxToolConfig('psf/black')).toStrictEqual({
        packageName: 'psf/black',
        datasource: 'github-tags',
      });
    });

    it('should create a tooling config for github url', () => {
      expect(
        createPipxToolConfig('git+https://github.com/psf/black.git'),
      ).toStrictEqual({
        packageName: 'psf/black',
        datasource: 'github-tags',
      });
    });

    it('should create a tooling config for git url', () => {
      expect(
        createPipxToolConfig('git+https://gitlab.com/user/repo.git'),
      ).toStrictEqual({
        packageName: 'https://gitlab.com/user/repo',
        datasource: 'git-refs',
      });
    });

    it('provides skipReason for zip file url', () => {
      expect(
        createPipxToolConfig('https://github.com/psf/black/archive/18.9b0.zip'),
      ).toStrictEqual({
        packageName: 'https://github.com/psf/black/archive/18.9b0.zip',
        skipReason: 'unsupported-url',
      });
    });
  });

  describe('createSpmToolConfig()', () => {
    it('should create a tooling config for github shorthand', () => {
      expect(createSpmToolConfig('tuist/tuist')).toStrictEqual({
        packageName: 'tuist/tuist',
        datasource: 'github-releases',
      });
    });

    it('should create a tooling config for github url', () => {
      expect(
        createSpmToolConfig('https://github.com/tuist/tuist.git'),
      ).toStrictEqual({
        packageName: 'tuist/tuist',
        datasource: 'github-releases',
      });
    });

    it('provides skipReason for other url', () => {
      expect(
        createSpmToolConfig('https://gitlab.com/user/repo.git'),
      ).toStrictEqual({
        packageName: 'https://gitlab.com/user/repo.git',
        skipReason: 'unsupported-url',
      });
    });
  });

  describe('createUbiToolConfig()', () => {
    it('should create a tooling config with empty options', () => {
      expect(createUbiToolConfig('nekto/act', '0.2.70', {})).toStrictEqual({
        packageName: 'nekto/act',
        datasource: 'github-releases',
        currentValue: '0.2.70',
        extractVersion: '^v?(?<version>.+)',
      });
    });

    it('should set extractVersion if the version does not have leading v', () => {
      expect(createUbiToolConfig('cli/cli', '2.64.0', {})).toStrictEqual({
        packageName: 'cli/cli',
        datasource: 'github-releases',
        currentValue: '2.64.0',
        extractVersion: '^v?(?<version>.+)',
      });
    });

    it('should not set extractVersion if the version has leading v', () => {
      expect(createUbiToolConfig('cli/cli', 'v2.64.0', {})).toStrictEqual({
        packageName: 'cli/cli',
        datasource: 'github-releases',
        currentValue: 'v2.64.0',
      });
    });

    it('should ignore options unless tag_regex is provided', () => {
      expect(
        createUbiToolConfig('cli/cli', '2.64.0', { exe: 'gh' } as any),
      ).toStrictEqual({
        packageName: 'cli/cli',
        datasource: 'github-releases',
        currentValue: '2.64.0',
        extractVersion: '^v?(?<version>.+)',
      });
    });

    it('should set extractVersion if tag_regex is provided', () => {
      expect(
        createUbiToolConfig('cargo-bins/cargo-binstall', '1.10.17', {
          tag_regex: '^\\d+\\.\\d+\\.',
        }),
      ).toStrictEqual({
        packageName: 'cargo-bins/cargo-binstall',
        datasource: 'github-releases',
        currentValue: '1.10.17',
        extractVersion: '^v?(?<version>\\d+\\.\\d+\\.)',
      });
    });

    it('should set extractVersion without v? when tag_regex is provided and version starts with v', () => {
      expect(
        createUbiToolConfig('cargo-bins/cargo-binstall', 'v1.10.17', {
          tag_regex: '^\\d+\\.\\d+\\.',
        }),
      ).toStrictEqual({
        packageName: 'cargo-bins/cargo-binstall',
        datasource: 'github-releases',
        currentValue: 'v1.10.17',
        extractVersion: '^(?<version>\\d+\\.\\d+\\.)',
      });
    });

    it('should trim the leading ^ from tag_regex', () => {
      expect(
        createUbiToolConfig('cargo-bins/cargo-binstall', 'v1.10.17', {
          tag_regex: '^\\d+\\.\\d+\\.',
        }),
      ).toStrictEqual({
        packageName: 'cargo-bins/cargo-binstall',
        datasource: 'github-releases',
        currentValue: 'v1.10.17',
        extractVersion: '^(?<version>\\d+\\.\\d+\\.)',
      });
    });

    it('should only trim the leading ^ from tag_regex when version starts with v', () => {
      expect(
        createUbiToolConfig('cargo-bins/cargo-binstall', 'v1.10.17', {
          tag_regex: '^v\\d+\\.\\d+\\.',
        }),
      ).toStrictEqual({
        packageName: 'cargo-bins/cargo-binstall',
        datasource: 'github-releases',
        currentValue: 'v1.10.17',
        extractVersion: '^(?<version>v\\d+\\.\\d+\\.)',
      });
    });

    it('should trim the leading ^v from tag_regex', () => {
      expect(
        createUbiToolConfig('cargo-bins/cargo-binstall', '1.10.17', {
          tag_regex: '^v\\d+\\.\\d+\\.',
        }),
      ).toStrictEqual({
        packageName: 'cargo-bins/cargo-binstall',
        datasource: 'github-releases',
        currentValue: '1.10.17',
        extractVersion: '^v?(?<version>\\d+\\.\\d+\\.)',
      });
    });

    it('should trim the leading ^v? from tag_regex', () => {
      expect(
        createUbiToolConfig('cargo-bins/cargo-binstall', '1.10.17', {
          tag_regex: '^v?\\d+\\.\\d+\\.',
        }),
      ).toStrictEqual({
        packageName: 'cargo-bins/cargo-binstall',
        datasource: 'github-releases',
        currentValue: '1.10.17',
        extractVersion: '^v?(?<version>\\d+\\.\\d+\\.)',
      });
    });
  });
});
