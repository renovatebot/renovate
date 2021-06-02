import { getName } from '../../../test/util';
import type { RenovateConfig } from '../../config/types';
import { PLATFORM_TYPE_GITHUB } from '../../constants/platforms';
import * as platform from '../../platform';
import * as _ghApi from '../../platform/github';
import * as _hostRules from '../../util/host-rules';
import { autodiscoverRepositories } from './autodiscover';
import { massageConfig } from '../../config/massage';

jest.mock('../../platform/github');
jest.unmock('../../platform');

// imports are readonly
const hostRules = _hostRules;
const ghApi: jest.Mocked<typeof _ghApi> = _ghApi as never;

describe(getName(), () => {
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
    config = massageConfig(config);
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
    config = massageConfig(config);
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
    config = massageConfig(config);
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['project/repo']);
  });
  it('filters autodiscovered github repos but nothing matches', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = ['project/re*'];
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() =>
      Promise.resolve(['another-project/repo', 'another-project/another-repo'])
    );
    config = massageConfig(config);
    const res = await autodiscoverRepositories(config);
    expect(res).toEqual(config);
  });
  it('filters autodiscovered github repos with string variable', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = 'project/re*';
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() =>
      Promise.resolve(['project/repo', 'another-project/another-repo'])
    );
    config = massageConfig(config);
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['project/repo']);
  });
  it('filters autodiscovered github repos with string variable but empty', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = 'project/re*';
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() =>
      Promise.resolve(['not-a-target/repo', 'another-project/another-repo'])
    );
    config = massageConfig(config);
    const res = await autodiscoverRepositories(config);
    expect(res).toEqual(config);
  });
  it('filters autodiscoverd repos with string variable deeper', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = 'myprj/**/*';
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() =>
      Promise.resolve([
        'myprj/subgroup-1/renovate-test-3',
        'another-project/another-repo',
      ])
    );
    config = massageConfig(config);
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['myprj/subgroup-1/renovate-test-3']);
  });
});
