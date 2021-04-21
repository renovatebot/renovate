import { getName } from '../../../test/util';
import type { RenovateConfig } from '../../config/types';
import { PLATFORM_TYPE_GITHUB } from '../../constants/platforms';
import * as platform from '../../platform';
import * as _ghApi from '../../platform/github';
import * as _hostRules from '../../util/host-rules';
import { autodiscoverRepositories } from './autodiscover';

jest.mock('../../platform/github');
jest.unmock('../../platform');

// imports are readonly
const hostRules = _hostRules;
const ghApi: jest.Mocked<typeof _ghApi> = _ghApi as never;

describe(getName(__filename), () => {
  let config: RenovateConfig;
  beforeEach(async () => {
    jest.resetAllMocks();
    config = {};
    await platform.initPlatform({
      platform: PLATFORM_TYPE_GITHUB,
      token: 'abc123',
      endpoint: 'endpoint',
    });
  });
  it('returns if not autodiscovering', async () => {
    expect(await autodiscoverRepositories(config)).toEqual(config);
  });
  it('autodiscovers github but empty', async () => {
    config.autodiscover = true;
    config.platform = PLATFORM_TYPE_GITHUB;
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() => Promise.resolve([]));
    const res = await autodiscoverRepositories(config);
    expect(res).toEqual(config);
  });
  it('autodiscovers github repos', async () => {
    config.autodiscover = true;
    config.platform = PLATFORM_TYPE_GITHUB;
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() => Promise.resolve(['a', 'b']));
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toHaveLength(2);
  });
  it('filters autodiscovered github repos', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = 'project/re*';
    config.platform = PLATFORM_TYPE_GITHUB;
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() =>
      Promise.resolve(['project/repo', 'project/another-repo'])
    );
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['project/repo']);
  });
  it('filters autodiscovered github repos but nothing matches', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = 'project/re*';
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() =>
      Promise.resolve(['another-project/repo', 'another-project/another-repo'])
    );
    const res = await autodiscoverRepositories(config);
    expect(res).toEqual(config);
  });
});
