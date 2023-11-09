import type { RenovateConfig } from '../../config/types';
import * as platform from '../../modules/platform';
import * as _ghApi from '../../modules/platform/github';
import * as _hostRules from '../../util/host-rules';
import { autodiscoverRepositories } from './autodiscover';

jest.mock('../../modules/platform/github');
jest.unmock('../../modules/platform');
jest.unmock('../../modules/platform/scm');

// imports are readonly
const hostRules = _hostRules;
const ghApi: jest.Mocked<typeof _ghApi> = _ghApi as never;

describe('workers/global/autodiscover', () => {
  let config: RenovateConfig;

  beforeEach(async () => {
    config = {};
    await platform.initPlatform({
      platform: 'github',
      token: '123test',
      endpoint: 'endpoint',
    });
  });

  it('throws if local and repositories defined', async () => {
    config.platform = 'local';
    config.repositories = ['a'];
    await expect(autodiscoverRepositories(config)).rejects.toThrow();
  });

  it('returns local', async () => {
    config.platform = 'local';
    expect((await autodiscoverRepositories(config)).repositories).toEqual([
      'local',
    ]);
  });

  it('returns if not autodiscovering', async () => {
    expect(await autodiscoverRepositories(config)).toEqual(config);
  });

  it('autodiscovers github but empty', async () => {
    config.autodiscover = true;
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() => Promise.resolve([]));
    const res = await autodiscoverRepositories(config);
    expect(res).toEqual(config);
  });

  it('autodiscovers github repos', async () => {
    config.autodiscover = true;
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() => Promise.resolve(['a', 'b']));
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toHaveLength(2);
  });

  it('filters autodiscovered github repos', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = ['project/re*'];
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() =>
      Promise.resolve(['project/repo', 'project/another-repo']),
    );
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['project/repo']);
  });

  it('filters autodiscovered dot repos', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = ['project/*'];
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() =>
      Promise.resolve(['project/repo', 'project/.github']),
    );
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['project/repo', 'project/.github']);
  });

  it('filters autodiscovered github repos but nothing matches', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = ['project/re*'];
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() =>
      Promise.resolve(['another-project/repo', 'another-project/another-repo']),
    );
    const res = await autodiscoverRepositories(config);
    expect(res).toEqual(config);
  });

  it('filters autodiscovered github repos with regex', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = ['/project/re*./'];
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() =>
      Promise.resolve(['project/repo', 'project/another-repo']),
    );
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['project/repo']);
  });

  it('filters autodiscovered github repos with regex negation', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = ['!/project/re*./'];
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() =>
      Promise.resolve(['project/repo', 'project/another-repo']),
    );
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['project/another-repo']);
  });

  it('filters autodiscovered github repos with minimatch negation', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = '!project/re*';
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() =>
      Promise.resolve(['project/repo', 'project/another-repo']),
    );
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['project/another-repo']);
  });

  it('fail if regex pattern is not valid', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = ['/project/re**./'];
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() =>
      Promise.resolve(['project/repo', 'project/another-repo']),
    );
    await expect(autodiscoverRepositories(config)).rejects.toThrow();
  });

  it('filters autodiscovered github repos with multiple values', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = ['another-project/re*', 'department/dev/*'];
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    const expectedRepositories = [
      'another-project/repo',
      'department/dev/aProject',
    ];
    ghApi.getRepos = jest.fn(() =>
      Promise.resolve([
        'another-project/another-repo',
        ...expectedRepositories,
      ]),
    );
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(expectedRepositories);
  });

  it('filters autodiscovered github repos case-insensitive', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = ['project/re*'];
    config.platform = 'github';
    hostRules.find = jest.fn(() => ({
      token: 'abc',
    }));
    ghApi.getRepos = jest.fn(() =>
      Promise.resolve(['project/repo', 'PROJECT/repo2']),
    );
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['project/repo', 'PROJECT/repo2']);
  });
});
