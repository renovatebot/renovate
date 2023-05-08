import { GlobalConfig } from '../../../config/global';
import * as hostRules from '../../../util/host-rules';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { Lockfile, PackageFile } from './schema';
import {
  extractConstraints,
  findGithubToken,
  getComposerArguments,
  isGithubFineGrainedPersonalAccessToken,
  isGithubPersonalAccessToken,
  isGithubServerToServerToken,
  requireComposerDependencyInstallation,
  takePersonalAccessTokenIfPossible,
} from './utils';

jest.mock('../../datasource');

describe('modules/manager/composer/utils', () => {
  beforeEach(() => {
    hostRules.clear();
  });

  describe('extractConstraints', () => {
    it('returns from require', () => {
      const file = PackageFile.parse({
        require: { php: '>=5.3.2', 'composer/composer': '1.1.0' },
      });
      const lockfile = Lockfile.parse({});
      expect(extractConstraints(file, lockfile)).toEqual({
        php: '>=5.3.2',
        composer: '1.1.0',
      });
    });

    it('returns platform php version', () => {
      const file = PackageFile.parse({
        config: { platform: { php: '7.4.27' } },
        require: { php: '~7.4 || ~8.0' },
      });
      const lockfile = Lockfile.parse({});
      expect(extractConstraints(file, lockfile)).toEqual({
        composer: '1.*',
        php: '<=7.4.27',
      });
    });

    it('returns platform 0 minor php version', () => {
      const file = PackageFile.parse({
        config: { platform: { php: '7.0.5' } },
        require: { php: '^7.0 || ~8.0' },
      });
      const lockfile = Lockfile.parse({});
      expect(extractConstraints(file, lockfile)).toEqual({
        composer: '1.*',
        php: '<=7.0.5',
      });
    });

    it('returns platform 0 patch php version', () => {
      const file = PackageFile.parse({
        config: { platform: { php: '7.4.0' } },
        require: { php: '^7.0 || ~8.0' },
      });
      const lockfile = Lockfile.parse({});
      expect(extractConstraints(file, lockfile)).toEqual({
        composer: '1.*',
        php: '<=7.4.0',
      });
    });

    it('returns platform lowest minor php version', () => {
      const file = PackageFile.parse({
        config: { platform: { php: '7' } },
        require: { php: '^7.0 || ~8.0' },
      });
      const lockfile = Lockfile.parse({});
      expect(extractConstraints(file, lockfile)).toEqual({
        composer: '1.*',
        php: '<=7.0.0',
      });
    });

    it('returns platform lowest patch php version', () => {
      const file = PackageFile.parse({
        config: { platform: { php: '7.4' } },
        require: { php: '~7.4 || ~8.0' },
      });
      const lockfile = Lockfile.parse({});
      expect(extractConstraints(file, lockfile)).toEqual({
        composer: '1.*',
        php: '<=7.4.0',
      });
    });

    it('returns from require-dev', () => {
      const file = PackageFile.parse({
        'require-dev': { 'composer/composer': '1.1.0' },
      });
      const lockfile = Lockfile.parse({});
      expect(extractConstraints(file, lockfile)).toEqual({ composer: '1.1.0' });
    });

    it('returns from composer platform require', () => {
      const file = PackageFile.parse({
        require: { php: '^8.1', composer: '2.2.0' },
      });
      const lockfile = Lockfile.parse({});
      expect(extractConstraints(file, lockfile)).toEqual({
        php: '^8.1',
        composer: '2.2.0',
      });
    });

    it('returns from composer platform require-dev', () => {
      const file = PackageFile.parse({ 'require-dev': { composer: '^2.2' } });
      const lockfile = Lockfile.parse({});
      expect(extractConstraints(file, lockfile)).toEqual({ composer: '^2.2' });
    });

    it('returns from composer-runtime-api', () => {
      const file = PackageFile.parse({
        require: { 'composer-runtime-api': '^1.1.0' },
      });
      const lockfile = Lockfile.parse({});
      expect(extractConstraints(file, lockfile)).toEqual({ composer: '^1.1' });
    });

    it('returns from plugin-api-version', () => {
      const file = PackageFile.parse({});
      const lockfile = Lockfile.parse({ 'plugin-api-version': '1.1.0' });
      expect(extractConstraints(file, lockfile)).toEqual({
        composer: '^1.1',
      });
    });

    it('fallback to 1.*', () => {
      const file = PackageFile.parse({});
      const lockfile = Lockfile.parse({});
      expect(extractConstraints(file, lockfile)).toEqual({ composer: '1.*' });
    });
  });

  describe('getComposerArguments', () => {
    afterEach(() => {
      GlobalConfig.reset();
    });

    it('disables scripts and plugins by default', () => {
      expect(
        getComposerArguments({}, { toolName: 'composer', constraint: '1.*' })
      ).toBe(
        ' --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });

    it('disables platform requirements', () => {
      expect(
        getComposerArguments(
          {
            composerIgnorePlatformReqs: [],
          },
          { toolName: 'composer', constraint: '1.*' }
        )
      ).toBe(
        ' --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });

    it('disables all platform requirements with 2.1.0', () => {
      expect(
        getComposerArguments(
          {
            composerIgnorePlatformReqs: [],
          },
          { toolName: 'composer', constraint: '2.1.0' }
        )
      ).toBe(
        ' --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });

    it('disables only extension and library platform requirements with 2.2.0', () => {
      expect(
        getComposerArguments(
          {
            composerIgnorePlatformReqs: [],
          },
          { toolName: 'composer', constraint: '2.2.0' }
        )
      ).toBe(
        " --ignore-platform-req='ext-*' --ignore-platform-req='lib-*' --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins"
      );
    });

    it('disables only extension and library platform requirements with ^2.2', () => {
      expect(
        getComposerArguments(
          {
            composerIgnorePlatformReqs: [],
          },
          { toolName: 'composer', constraint: '^2.2' }
        )
      ).toBe(
        " --ignore-platform-req='ext-*' --ignore-platform-req='lib-*' --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins"
      );
    });

    it('disables single platform requirement', () => {
      expect(
        getComposerArguments(
          {
            composerIgnorePlatformReqs: ['ext-intl'],
          },
          { toolName: 'composer', constraint: '1.*' }
        )
      ).toBe(
        ' --ignore-platform-req ext-intl --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });

    it('disables multiple platform requirement', () => {
      expect(
        getComposerArguments(
          {
            composerIgnorePlatformReqs: ['ext-intl', 'ext-icu'],
          },
          { toolName: 'composer', constraint: '1.*' }
        )
      ).toBe(
        ' --ignore-platform-req ext-intl --ignore-platform-req ext-icu --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });

    it('allows scripts when configured', () => {
      GlobalConfig.set({
        allowScripts: true,
      });
      expect(
        getComposerArguments({}, { toolName: 'composer', constraint: '1.*' })
      ).toBe(' --no-ansi --no-interaction --no-plugins');
    });

    it('disables scripts when configured locally', () => {
      GlobalConfig.set({
        allowScripts: true,
      });
      expect(
        getComposerArguments(
          {
            ignoreScripts: true,
          },
          { toolName: 'composer', constraint: '1.*' }
        )
      ).toBe(
        ' --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });

    it('allows plugins when configured', () => {
      GlobalConfig.set({
        allowPlugins: true,
      });
      expect(
        getComposerArguments({}, { toolName: 'composer', constraint: '1.*' })
      ).toBe(' --no-ansi --no-interaction --no-scripts --no-autoloader');
    });

    it('disables plugins when configured locally', () => {
      GlobalConfig.set({
        allowPlugins: true,
      });
      expect(
        getComposerArguments(
          {
            ignorePlugins: true,
          },
          { toolName: 'composer', constraint: '1.*' }
        )
      ).toBe(
        ' --no-ansi --no-interaction --no-scripts --no-autoloader --no-plugins'
      );
    });
  });

  describe('requireComposerDependencyInstallation', () => {
    it('returns true when symfony/flex has been installed', () => {
      const lockfile = Lockfile.parse({
        packages: [{ name: 'symfony/flex', version: '1.17.1' }],
      });
      expect(requireComposerDependencyInstallation(lockfile)).toBeTrue();
    });

    it('returns true when symfony/flex has been installed as dev dependency', () => {
      const lockfile = Lockfile.parse({
        'packages-dev': [{ name: 'symfony/flex', version: '1.17.1' }],
      });
      expect(requireComposerDependencyInstallation(lockfile)).toBeTrue();
    });

    it('returns false when symfony/flex has not been installed', () => {
      const lockfile = Lockfile.parse({
        packages: [{ name: 'symfony/console', version: '5.4.0' }],
      });
      expect(requireComposerDependencyInstallation(lockfile)).toBeFalse();
    });
  });

  describe('findGithubToken', () => {
    it('returns the token string when hostRule match search with a valid personal access token', () => {
      const TOKEN_STRING = 'ghp_TOKEN';
      hostRules.add({
        hostType: GitTagsDatasource.id,
        matchHost: 'github.com',
        token: TOKEN_STRING,
      });

      const foundHostRule = hostRules.find({
        hostType: GitTagsDatasource.id,
        url: 'https://github.com',
      });

      expect(findGithubToken(foundHostRule)).toEqual(TOKEN_STRING);
    });

    it('returns undefined when no token is defined', () => {
      hostRules.add({
        hostType: GitTagsDatasource.id,
        matchHost: 'github.com',
      });

      const foundHostRule = hostRules.find({
        hostType: GitTagsDatasource.id,
        url: 'https://github.com',
      });
      expect(findGithubToken(foundHostRule)).toBeUndefined();
    });

    it('remove x-access-token token prefix', () => {
      const TOKEN_STRING_WITH_PREFIX = 'x-access-token:ghp_TOKEN';
      const TOKEN_STRING = 'ghp_TOKEN';
      hostRules.add({
        hostType: GitTagsDatasource.id,
        matchHost: 'github.com',
        token: TOKEN_STRING_WITH_PREFIX,
      });

      const foundHostRule = hostRules.find({
        hostType: GitTagsDatasource.id,
        url: 'https://github.com',
      });
      expect(findGithubToken(foundHostRule)).toEqual(TOKEN_STRING);
    });
  });

  describe('isGithubPersonalAccessToken', () => {
    it('returns true when string is a github personnal access token', () => {
      expect(isGithubPersonalAccessToken('ghp_XXXXXX')).toBeTrue();
    });

    it('returns false when string is a github application token', () => {
      expect(isGithubPersonalAccessToken('ghs_XXXXXX')).toBeFalse();
    });

    it('returns false when string is a github fine grained personal access token', () => {
      expect(isGithubPersonalAccessToken('github_pat_XXXXXX')).toBeFalse();
    });

    it('returns false when string is not a token at all', () => {
      expect(isGithubPersonalAccessToken('XXXXXX')).toBeFalse();
    });
  });

  describe('isGithubServerToServerToken', () => {
    it('returns true when string is a github server to server token', () => {
      expect(isGithubServerToServerToken('ghs_XXXXXX')).toBeTrue();
    });

    it('returns false when string is a github personal access token token', () => {
      expect(isGithubServerToServerToken('ghp_XXXXXX')).toBeFalse();
    });

    it('returns false when string is a github fine grained personal access token', () => {
      expect(isGithubPersonalAccessToken('github_pat_XXXXXX')).toBeFalse();
    });

    it('returns false when string is not a token at all', () => {
      expect(isGithubServerToServerToken('XXXXXX')).toBeFalse();
    });
  });

  describe('isGithubFineGrainedPersonalAccessToken', () => {
    it('returns true when string is a github fine grained personal access token', () => {
      expect(
        isGithubFineGrainedPersonalAccessToken('github_pat_XXXXXX')
      ).toBeTrue();
    });

    it('returns false when string is a github personnal access token', () => {
      expect(isGithubFineGrainedPersonalAccessToken('ghp_XXXXXX')).toBeFalse();
    });

    it('returns false when string is a github application token', () => {
      expect(isGithubFineGrainedPersonalAccessToken('ghs_XXXXXX')).toBeFalse();
    });

    it('returns false when string is not a token at all', () => {
      expect(isGithubFineGrainedPersonalAccessToken('XXXXXX')).toBeFalse();
    });
  });

  describe('takePersonalAccessTokenIfPossible', () => {
    it('returns undefined when both token are undefined', () => {
      const githubToken = undefined;
      const gitTagsGithubToken = undefined;
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken)
      ).toBeUndefined();
    });

    it('returns gitTagsToken when both token are PAT', () => {
      const githubToken = 'ghp_github';
      const gitTagsGithubToken = 'ghp_gitTags';
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken)
      ).toEqual(gitTagsGithubToken);
    });

    it('returns githubToken is PAT and gitTagsGithubToken is not a PAT', () => {
      const githubToken = 'ghp_github';
      const gitTagsGithubToken = 'ghs_gitTags';
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken)
      ).toEqual(githubToken);
    });

    it('returns gitTagsToken when both token are set but not PAT', () => {
      const githubToken = 'ghs_github';
      const gitTagsGithubToken = 'ghs_gitTags';
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken)
      ).toEqual(gitTagsGithubToken);
    });

    it('returns gitTagsToken when gitTagsToken not PAT and gitTagsGithubToken is not set', () => {
      const githubToken = undefined;
      const gitTagsGithubToken = 'ghs_gitTags';
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken)
      ).toEqual(gitTagsGithubToken);
    });

    it('returns githubToken when githubToken not PAT and gitTagsGithubToken is not set', () => {
      const githubToken = 'ghs_gitTags';
      const gitTagsGithubToken = undefined;
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken)
      ).toEqual(githubToken);
    });

    it('take personal assess token over fine grained token', () => {
      const githubToken = 'ghp_github';
      const gitTagsGithubToken = 'github_pat_gitTags';
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken)
      ).toEqual(githubToken);
    });

    it('take fine grained token over server to server token', () => {
      const githubToken = 'github_pat_github';
      const gitTagsGithubToken = 'ghs_gitTags';
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken)
      ).toEqual(githubToken);
    });

    it('take git-tags fine grained token', () => {
      const githubToken = undefined;
      const gitTagsGithubToken = 'github_pat_gitTags';
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken)
      ).toEqual(gitTagsGithubToken);
    });

    it('take git-tags unknown token type when no other token is set', () => {
      const githubToken = undefined;
      const gitTagsGithubToken = 'unknownTokenType_gitTags';
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken)
      ).toEqual(gitTagsGithubToken);
    });

    it('take github unknown token type when no other token is set', () => {
      const githubToken = 'unknownTokenType';
      const gitTagsGithubToken = undefined;
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken)
      ).toEqual(githubToken);
    });
  });
});
