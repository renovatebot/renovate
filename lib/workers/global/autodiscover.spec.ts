import { createHash } from 'node:crypto';
import type { RenovateConfig } from '../../config/types';
import * as platform from '../../modules/platform';
import * as _ghApi from '../../modules/platform/github';
import * as _hostRules from '../../util/host-rules';
import {
  addModularClass,
  addPlainInteger,
  addToRange,
  applyShard,
  autodiscoverRepositories,
  expandShardSelector,
  parseInterval,
  parseModularClass,
  parsePlainInteger,
} from './autodiscover';

vi.mock('../../modules/platform/github');
vi.mock('../../util/host-rules');
vi.unmock('../../modules/platform');
vi.unmock('../../modules/platform/scm');

// imports are readonly
const hostRules = vi.mocked(_hostRules);
const ghApi = vi.mocked(_ghApi);

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
    hostRules.find.mockImplementation(() => ({
      token: 'abc',
    }));
    ghApi.getRepos.mockImplementation(() => Promise.resolve([]));
    const res = await autodiscoverRepositories(config);
    expect(res).toEqual(config);
  });

  it('autodiscovers github repos', async () => {
    config.autodiscover = true;
    config.platform = 'github';
    hostRules.find.mockImplementation(() => ({
      token: 'abc',
    }));
    ghApi.getRepos.mockImplementation(() => Promise.resolve(['a', 'b']));
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toHaveLength(2);
  });

  it('filters autodiscovered github repos', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = ['project/re*'];
    config.platform = 'github';
    hostRules.find.mockImplementation(() => ({
      token: 'abc',
    }));
    ghApi.getRepos.mockImplementation(() =>
      Promise.resolve(['project/repo', 'project/another-repo']),
    );
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['project/repo']);
  });

  it('filters autodiscovered dot repos', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = ['project/*'];
    config.platform = 'github';
    hostRules.find.mockImplementation(() => ({
      token: 'abc',
    }));
    ghApi.getRepos.mockImplementation(() =>
      Promise.resolve(['project/repo', 'project/.github']),
    );
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['project/repo', 'project/.github']);
  });

  it('filters autodiscovered github repos but nothing matches', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = ['project/re*'];
    config.platform = 'github';
    hostRules.find.mockImplementation(() => ({
      token: 'abc',
    }));
    ghApi.getRepos.mockImplementation(() =>
      Promise.resolve(['another-project/repo', 'another-project/another-repo']),
    );
    const res = await autodiscoverRepositories(config);
    expect(res).toEqual(config);
  });

  it('filters autodiscovered github repos with regex', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = ['/project/RE*./i'];
    config.platform = 'github';
    hostRules.find.mockImplementation(() => ({
      token: 'abc',
    }));
    ghApi.getRepos.mockImplementation(() =>
      Promise.resolve(['project/repo', 'project/another-repo']),
    );
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['project/repo']);
  });

  it('filters autodiscovered github repos with regex negation', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = ['!/project/re*./', '!project/yet*'];
    config.platform = 'github';
    hostRules.find.mockImplementation(() => ({
      token: 'abc',
    }));
    ghApi.getRepos.mockImplementation(() =>
      Promise.resolve([
        'project/repo',
        'project/another-repo',
        'project/yet-another-repo',
      ]),
    );
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['project/another-repo']);
  });

  it('filters autodiscovered github repos with minimatch negation', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = '!project/re*';
    config.platform = 'github';
    hostRules.find.mockImplementation(() => ({
      token: 'abc',
    }));
    ghApi.getRepos.mockImplementation(() =>
      Promise.resolve(['project/repo', 'project/another-repo']),
    );
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['project/another-repo']);
  });

  it('fail if regex pattern is not valid', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = ['/project/re**./'];
    config.platform = 'github';
    hostRules.find.mockImplementation(() => ({
      token: 'abc',
    }));
    ghApi.getRepos.mockImplementation(() =>
      Promise.resolve(['project/repo', 'project/another-repo']),
    );
    const res = await autodiscoverRepositories(config);
    expect(res).toEqual(config);
  });

  it('filters autodiscovered github repos with multiple values', async () => {
    config.autodiscover = true;
    config.autodiscoverFilter = ['another-project/re*', 'department/dev/*'];
    config.platform = 'github';
    hostRules.find.mockImplementation(() => ({
      token: 'abc',
    }));
    // retains order
    const expectedRepositories = [
      'department/dev/aProject',
      'another-project/repo',
      'department/dev/bProject',
    ];
    ghApi.getRepos.mockImplementation(() =>
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
    hostRules.find.mockImplementation(() => ({
      token: 'abc',
    }));
    ghApi.getRepos.mockImplementation(() =>
      Promise.resolve(['project/repo', 'PROJECT/repo2']),
    );
    const res = await autodiscoverRepositories(config);
    expect(res.repositories).toEqual(['project/repo', 'PROJECT/repo2']);
  });

  describe('autodiscover shard sharding logic', () => {
    describe('expandShardSelector', () => {
      it('handles interval union: "0-3,8-9"', () => {
        expect(expandShardSelector('0-3,8-9', 16)).toEqual([0, 1, 2, 3, 8, 9]);
      });
      it('handles modular class: "*/5+2"', () => {
        expect(expandShardSelector('*/5+2', 16)).toEqual([2, 7, 12]);
      });
      it('handles mixed syntaxes: "1,3-4,*/8"', () => {
        expect(expandShardSelector('1,3-4,*/8', 16)).toEqual([0, 1, 3, 4, 8]);
      });
      it('clips out-of-range: "14-99" with shards=16', () => {
        expect(expandShardSelector('14-99', 16)).toEqual([14, 15]);
      });
      it('returns empty for empty parse: "900-901"', () => {
        expect(expandShardSelector('900-901', 16)).toEqual([]);
      });
      it('returns empty when selector is undefined or shards <= 0', () => {
        expect(expandShardSelector(undefined, 16)).toEqual([]);
        expect(expandShardSelector('1,2', 0)).toEqual([]);
        expect(expandShardSelector('1,2', -5)).toEqual([]);
      });
      it('skips empty tokens in selector', () => {
        expect(expandShardSelector('1, ,3,, */8', 16)).toEqual([0, 1, 3, 8]);
      });
    });

    describe('applyShard', () => {
      const repos = Array.from({ length: 20 }, (_, i) => `repo${i}`);
      it('returns all if no shards', () => {
        expect(
          applyShard(repos, { shards: undefined, shard: undefined }),
        ).toEqual(repos);
      });
      it('returns empty if selector is empty', () => {
        expect(applyShard(repos, { shards: 16, shard: '900-901' })).toEqual([]);
      });
      it('shards correctly for interval', () => {
        const result = applyShard(repos, { shards: 16, shard: '0-3' });
        expect(
          result.every((r: string) => {
            const hash = createHash('sha256').update('').update(r).digest();
            const mod = hash.readUInt32BE(0) % 16;
            return [0, 1, 2, 3].includes(mod);
          }),
        ).toBe(true);
      });
      it('shards correctly for modular class', () => {
        const result = applyShard(repos, { shards: 16, shard: '*/4+1' });
        expect(
          result.every((r: string) => {
            const hash = createHash('sha256').update('').update(r).digest();
            const mod = hash.readUInt32BE(0) % 16;
            return mod % 4 === 1 % 4;
          }),
        ).toBe(true);
      });
    });
  });

  describe('individual parser functions', () => {
    describe('parseModularClass', () => {
      it('parses modular class with offset', () => {
        expect(parseModularClass('*/5+2')).toEqual({ modulus: 5, offset: 2 });
      });
      it('parses modular class without offset', () => {
        expect(parseModularClass('*/3')).toEqual({ modulus: 3, offset: 0 });
      });
      it('returns null for invalid input', () => {
        expect(parseModularClass('invalid')).toBeNull();
        expect(parseModularClass('5+2')).toBeNull();
      });
    });

    describe('parseInterval', () => {
      it('parses interval without step', () => {
        expect(parseInterval('5-15')).toEqual({ start: 5, end: 15 });
      });
      it('returns null for invalid input', () => {
        expect(parseInterval('invalid')).toBeNull();
        expect(parseInterval('5')).toBeNull();
      });
      it('returns null for step syntax', () => {
        expect(parseInterval('0-10/3')).toBeNull();
      });
    });

    describe('parsePlainInteger', () => {
      it('parses valid integer', () => {
        expect(parsePlainInteger('42')).toBe(42);
        expect(parsePlainInteger('0')).toBe(0);
      });
      it('returns null for invalid input', () => {
        expect(parsePlainInteger('abc')).toBeNull();
        expect(parsePlainInteger('1.5')).toBeNull();
        expect(parsePlainInteger('')).toBeNull();
      });
    });

    describe('addModularClass', () => {
      it('adds correct modular class indices', () => {
        const picks = new Set<number>();
        addModularClass(picks, 5, 2, 16);
        expect([...picks].sort((a, b) => a - b)).toEqual([2, 7, 12]);
      });
      it('handles zero modulus gracefully', () => {
        const picks = new Set<number>();
        addModularClass(picks, 0, 2, 16);
        expect([...picks]).toEqual([]);
      });
    });

    describe('addToRange', () => {
      it('adds range without step', () => {
        const picks = new Set<number>();
        addToRange(picks, 0, 10, 16);
        expect([...picks].sort((a, b) => a - b)).toEqual([
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
        ]);
      });
      it('clips to shard bounds', () => {
        const picks = new Set<number>();
        addToRange(picks, 14, 99, 16);
        expect([...picks].sort((a, b) => a - b)).toEqual([14, 15]);
      });
    });

    describe('addPlainInteger', () => {
      it('adds valid integer within bounds', () => {
        const picks = new Set<number>();
        addPlainInteger(picks, 5, 16);
        expect([...picks]).toEqual([5]);
      });
      it('ignores out-of-bounds integer', () => {
        const picks = new Set<number>();
        addPlainInteger(picks, 20, 16);
        expect([...picks]).toEqual([]);
      });
      it('ignores negative integer', () => {
        const picks = new Set<number>();
        addPlainInteger(picks, -1, 16);
        expect([...picks]).toEqual([]);
      });
    });
  });

  describe('autodiscoverRepositories advanced paths', () => {
    it('applies sharding and returns empty when nothing selected', async () => {
      config.autodiscover = true;
      config.platform = 'github';
      hostRules.find.mockImplementation(() => ({ token: 'abc' }));
      ghApi.getRepos.mockImplementation(() =>
        Promise.resolve(['a', 'b', 'c', 'd']),
      );
      config.autodiscoverShardCount = 16;
      config.autodiscoverShardSelector = '900-901'; // selects nothing
      const res = await autodiscoverRepositories(config);
      expect(res.repositories).toEqual([]);
    });

    it('applies sharding and returns only selected repos', async () => {
      config.autodiscover = true;
      config.platform = 'github';
      hostRules.find.mockImplementation(() => ({ token: 'abc' }));
      const discovered = ['repo0', 'repo1', 'repo2', 'repo3', 'repo4', 'repo5'];
      ghApi.getRepos.mockImplementation(() => Promise.resolve(discovered));
      config.autodiscoverShardCount = 16;
      config.autodiscoverShardSelector = '0-3';
      config.autodiscoverShardSalt = '';
      const res = await autodiscoverRepositories(config);
      const expected = applyShard(discovered, {
        shards: 16,
        shard: '0-3',
        salt: '',
      });
      expect(res.repositories).toEqual(expected);
    });
  });
});
