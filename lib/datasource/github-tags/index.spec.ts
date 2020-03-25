import { api } from '../../platform/github/gh-got-wrapper';

import * as github from '.';
import * as _hostRules from '../../util/host-rules';

jest.mock('../../platform/github/gh-got-wrapper');
jest.mock('../../util/got');
jest.mock('../../util/host-rules');

const ghGot: jest.Mock<Promise<{
  headers?: unknown;
  body?: unknown;
}>> = api.get as never;
const hostRules: any = _hostRules;

describe('datasource/github-tags', () => {
  beforeEach(() => global.renovateCache.rmAll());
  describe('getDigest', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.hosts = jest.fn(() => []);
      global.repoCache = {};
      return global.renovateCache.rmAll();
    });
    it('returns null if no token', async () => {
      ghGot.mockResolvedValueOnce({ body: [] });
      const res = await github.getDigest({ lookupName: 'some/dep' }, null);
      expect(res).toBeNull();
    });
    it('returns digest', async () => {
      ghGot.mockResolvedValueOnce({ body: [{ sha: 'abcdef' }] });
      const res = await github.getDigest({ lookupName: 'some/dep' }, null);
      expect(res).toBe('abcdef');
    });
    it('returns commit digest', async () => {
      ghGot.mockResolvedValueOnce({
        body: { object: { type: 'commit', sha: 'ddd111' } },
      });
      const res = await github.getDigest({ lookupName: 'some/dep' }, 'v1.2.0');
      expect(res).toBe('ddd111');
    });
    it('returns tagged commit digest', async () => {
      ghGot.mockResolvedValueOnce({
        body: { object: { type: 'tag', url: 'some-url' } },
      });
      ghGot.mockResolvedValueOnce({
        body: { object: { type: 'commit', sha: 'ddd111' } },
      });
      const res = await github.getDigest({ lookupName: 'some/dep' }, 'v1.2.0');
      expect(res).toBe('ddd111');
    });
    it('warns if unknown ref', async () => {
      ghGot.mockResolvedValueOnce({
        body: { object: { sha: 'ddd111' } },
      });
      const res = await github.getDigest({ lookupName: 'some/dep' }, 'v1.2.0');
      expect(res).toBeNull();
    });
    it('returns null for missed tagged digest', async () => {
      ghGot.mockResolvedValueOnce({});
      const res = await github.getDigest({ lookupName: 'some/dep' }, 'v1.2.0');
      expect(res).toBeNull();
    });
  });
  describe('getPkgReleases', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      return global.renovateCache.rmAll();
    });
    it('returns tags ', async () => {
      const body = [{ name: 'v1.0.0' }, { name: 'v1.1.0' }];
      ghGot.mockResolvedValueOnce({ headers: {}, body });
      const res = await github.getPkgReleases({
        lookupName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(2);
    });
    it('returns null for errors', async () => {
      ghGot.mockImplementationOnce(() => {
        throw new Error();
      });
      const res = await github.getPkgReleases({
        lookupName: 'some/dep2',
      });
      expect(res).toBeNull();
    });
    it('returns tags with timestamp', async () => {
      ghGot.mockResolvedValueOnce({
        headers: {},
        body: [
          {
            name: 'v1.0.0',
            commit: {
              sha: 'foo',
              url: 'foo',
            },
          },
          {
            name: 'v1.1.0',
            commit: {
              sha: 'bar',
              url: 'bar',
            },
          },
        ],
      });
      ghGot.mockResolvedValueOnce({
        headers: {},
        body: { commit: { author: { date: '2019-04-18T20:13:57Z' } } },
      });
      ghGot.mockRejectedValueOnce(() => new Error());

      const res = await github.getPkgReleases({
        lookupName: 'some/dep2',
      });
      expect(ghGot).toBeCalledTimes(3);
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(2);
    });
    it('caches commit timestamps', async () => {
      const reset = async () => {
        jest.resetAllMocks();

        // reset only first cache layer
        await global.renovateCache.rm(
          'datasource-github-tags',
          'some/dep2:tags'
        );

        ghGot.mockResolvedValueOnce({
          headers: {},
          body: [
            {
              name: 'v1.0.0',
              commit: {
                sha: 'foo',
                url: 'foo',
              },
            },
          ],
        });
        ghGot.mockResolvedValueOnce({
          headers: {},
          body: { commit: { author: { date: '2019-04-18T20:13:57Z' } } },
        });
      };

      await reset();
      const res1 = await github.getPkgReleases({
        lookupName: 'some/dep2',
      });
      expect(ghGot).toBeCalledTimes(2);
      expect(res1).toMatchSnapshot();

      await reset();
      const res2 = await github.getPkgReleases({
        lookupName: 'some/dep2',
      });
      expect(ghGot).toBeCalledTimes(1);
      expect(res2).toEqual(res1);
    });
    it('updates cache for new tags', async () => {
      // First call
      ghGot.mockResolvedValueOnce({
        headers: {},
        body: [
          {
            name: 'v1.0.0',
            commit: {
              sha: 'foo',
              url: 'foo',
            },
          },
        ],
      });
      ghGot.mockResolvedValueOnce({
        headers: {},
        body: { commit: { author: { date: '2019-04-18T20:13:57Z' } } },
      });

      const res1 = await github.getPkgReleases({
        lookupName: 'some/dep2',
      });
      expect(ghGot).toBeCalledTimes(2);
      expect(res1).toMatchSnapshot();

      // Second call

      jest.resetAllMocks();

      // reset only first cache layer
      await global.renovateCache.rm('datasource-github-tags', 'some/dep2:tags');

      ghGot.mockResolvedValueOnce({
        headers: {},
        body: [
          {
            name: 'v1.0.0',
            commit: {
              sha: 'foo',
              url: 'foo',
            },
          },
          {
            name: 'v1.1.0',
            commit: {
              sha: 'bar',
              url: 'bar',
            },
          },
        ],
      });
      ghGot.mockResolvedValueOnce({
        headers: {},
        body: { commit: { author: { date: '2019-04-18T20:13:57Z' } } },
      });
      ghGot.mockResolvedValueOnce({
        headers: {},
        body: { commit: { author: { date: '2020-04-18T20:13:57Z' } } },
      });

      const res2 = await github.getPkgReleases({
        lookupName: 'some/dep2',
      });
      expect(ghGot).toBeCalledTimes(3);
      expect(res2).toMatchSnapshot();
    });
  });
});
