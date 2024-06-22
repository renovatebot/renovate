import { mockDeep } from 'jest-mock-extended';
import { hostRules, logger } from '../../test/util';
import { GlobalConfig } from '../config/global';
import { GithubReleasesDatasource } from '../modules/datasource/github-releases';
import { GithubTagsDatasource } from '../modules/datasource/github-tags';
import type { PackageFileContent } from '../modules/manager/types';
import * as memCache from '../util/cache/memory';
import {
  checkGithubToken,
  findGithubToken,
  isGithubFineGrainedPersonalAccessToken,
  isGithubPersonalAccessToken,
  isGithubServerToServerToken,
  takePersonalAccessTokenIfPossible,
} from './check-token';

jest.mock('./host-rules', () => mockDeep());

describe('util/check-token', () => {
  describe('checkGithubToken', () => {
    beforeEach(() => {
      memCache.reset();
      GlobalConfig.set({ githubTokenWarn: true });
    });

    it('does nothing if data is empty', () => {
      hostRules.find.mockReturnValue({});
      checkGithubToken(undefined);
      expect(logger.logger.trace).not.toHaveBeenCalled();
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('returns early if GitHub token is found', () => {
      hostRules.find.mockReturnValueOnce({ token: '123' });
      checkGithubToken({});
      expect(hostRules.find).toHaveBeenCalledWith({
        hostType: 'github',
        url: 'https://api.github.com',
      });
      expect(logger.logger.trace).toHaveBeenCalledWith('GitHub token is found');
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('returns early if token warnings are disabled', () => {
      GlobalConfig.set({ githubTokenWarn: false });
      hostRules.find.mockReturnValueOnce({});
      checkGithubToken({});
      expect(hostRules.find).toHaveBeenCalledWith({
        hostType: 'github',
        url: 'https://api.github.com',
      });
      expect(logger.logger.trace).toHaveBeenCalledWith(
        'GitHub token warning is disabled',
      );
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('does not warn if there is dependencies with GitHub sourceUrl', () => {
      hostRules.find.mockReturnValueOnce({});
      checkGithubToken({
        npm: [{ deps: [{ depName: 'renovatebot/renovate' }] }],
      });
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('logs warning for github-tags datasource', () => {
      hostRules.find.mockReturnValueOnce({});
      checkGithubToken({
        npm: [
          {
            deps: [
              {
                depName: 'foo/bar',
                datasource: GithubTagsDatasource.id,
              },
            ],
          },
        ],
      });
      expect(logger.logger.warn).toHaveBeenCalled();
    });

    it('logs warning for github-releases datasource', () => {
      hostRules.find.mockReturnValueOnce({});
      checkGithubToken({
        npm: [
          {
            deps: [
              {
                depName: 'foo/bar',
                datasource: GithubReleasesDatasource.id,
              },
            ],
          },
        ],
      });
      expect(logger.logger.warn).toHaveBeenCalled();
    });

    it('logs warning once', () => {
      hostRules.find.mockReturnValueOnce({});
      const packageFiles: Record<string, PackageFileContent[]> = {
        npm: [
          {
            deps: [
              {
                depName: 'foo/foo',
                datasource: GithubTagsDatasource.id,
              },
              {
                depName: 'bar/bar',
                datasource: GithubReleasesDatasource.id,
              },
            ],
          },
        ],
      };
      checkGithubToken(packageFiles);
      expect(logger.logger.warn).toHaveBeenCalledOnce();
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
        isGithubFineGrainedPersonalAccessToken('github_pat_XXXXXX'),
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

  describe('findGithubToken', () => {
    it('returns the token string when hostRule match search with a valid personal access token', () => {
      const TOKEN_STRING = 'ghp_TOKEN';

      expect(findGithubToken({ token: TOKEN_STRING })).toBe(TOKEN_STRING);
    });

    it('returns undefined when no token is defined', () => {
      expect(findGithubToken({})).toBeUndefined();
    });

    it('remove x-access-token token prefix', () => {
      const TOKEN_STRING_WITH_PREFIX = 'x-access-token:ghp_TOKEN';
      const TOKEN_STRING = 'ghp_TOKEN';

      expect(findGithubToken({ token: TOKEN_STRING_WITH_PREFIX })).toBe(
        TOKEN_STRING,
      );
    });
  });

  describe('takePersonalAccessTokenIfPossible', () => {
    it('returns undefined when both token are undefined', () => {
      const githubToken = undefined;
      const gitTagsGithubToken = undefined;
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken),
      ).toBeUndefined();
    });

    it('returns gitTagsToken when both token are PAT', () => {
      const githubToken = 'ghp_github';
      const gitTagsGithubToken = 'ghp_gitTags';
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken),
      ).toBe(gitTagsGithubToken);
    });

    it('returns githubToken is PAT and gitTagsGithubToken is not a PAT', () => {
      const githubToken = 'ghp_github';
      const gitTagsGithubToken = 'ghs_gitTags';
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken),
      ).toBe(githubToken);
    });

    it('returns gitTagsToken when both token are set but not PAT', () => {
      const githubToken = 'ghs_github';
      const gitTagsGithubToken = 'ghs_gitTags';
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken),
      ).toBe(gitTagsGithubToken);
    });

    it('returns gitTagsToken when gitTagsToken not PAT and gitTagsGithubToken is not set', () => {
      const githubToken = undefined;
      const gitTagsGithubToken = 'ghs_gitTags';
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken),
      ).toBe(gitTagsGithubToken);
    });

    it('returns githubToken when githubToken not PAT and gitTagsGithubToken is not set', () => {
      const githubToken = 'ghs_gitTags';
      const gitTagsGithubToken = undefined;
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken),
      ).toBe(githubToken);
    });

    it('take personal access token over fine grained token', () => {
      const githubToken = 'ghp_github';
      const gitTagsGithubToken = 'github_pat_gitTags';
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken),
      ).toBe(githubToken);
    });

    it('take fine grained token over server to server token', () => {
      const githubToken = 'github_pat_github';
      const gitTagsGithubToken = 'ghs_gitTags';
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken),
      ).toBe(githubToken);
    });

    it('take git-tags fine grained token', () => {
      const githubToken = undefined;
      const gitTagsGithubToken = 'github_pat_gitTags';
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken),
      ).toBe(gitTagsGithubToken);
    });

    it('take git-tags unknown token type when no other token is set', () => {
      const githubToken = undefined;
      const gitTagsGithubToken = 'unknownTokenType_gitTags';
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken),
      ).toBe(gitTagsGithubToken);
    });

    it('take github unknown token type when no other token is set', () => {
      const githubToken = 'unknownTokenType';
      const gitTagsGithubToken = undefined;
      expect(
        takePersonalAccessTokenIfPossible(githubToken, gitTagsGithubToken),
      ).toBe(githubToken);
    });
  });
});
