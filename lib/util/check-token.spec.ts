import { hostRules, logger } from '../../test/util';
import { GlobalConfig } from '../config/global';
import { GithubReleasesDatasource } from '../modules/datasource/github-releases';
import { GithubTagsDatasource } from '../modules/datasource/github-tags';
import type { PackageFile } from '../modules/manager/types';
import * as memCache from '../util/cache/memory';
import { checkGithubToken } from './check-token';

jest.mock('./host-rules');

describe('util/check-token', () => {
  beforeEach(() => {
    jest.resetAllMocks();
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
      'GitHub token warning is disabled'
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
    const packageFiles: Record<string, PackageFile[]> = {
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
