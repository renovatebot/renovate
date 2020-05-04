import { api } from '../../platform/github/gh-got-wrapper';

import * as _hostRules from '../../util/host-rules';
import * as github from '.';

jest.mock('../../platform/github/gh-got-wrapper');
jest.mock('../../util/got');
jest.mock('../../util/host-rules');

const ghGot: any = api.get;
const hostRules: any = _hostRules;

describe('datasource/github-tags', () => {
  beforeEach(() => global.renovateCache.rmAll());
  describe('getDigest', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.hosts = jest.fn(() => []);
      return global.renovateCache.rmAll();
    });
    it('returns null if no token', async () => {
      ghGot.mockReturnValueOnce({ body: [] });
      const res = await github.getDigest({ lookupName: 'some/dep' }, null);
      expect(res).toBeNull();
    });
    it('returns digest', async () => {
      ghGot.mockReturnValueOnce({ body: [{ sha: 'abcdef' }] });
      const res = await github.getDigest({ lookupName: 'some/dep' }, null);
      expect(res).toBe('abcdef');
    });
    it('returns commit digest', async () => {
      ghGot.mockReturnValueOnce({
        body: { object: { type: 'commit', sha: 'ddd111' } },
      });
      const res = await github.getDigest({ lookupName: 'some/dep' }, 'v1.2.0');
      expect(res).toBe('ddd111');
    });
    it('returns tagged commit digest', async () => {
      ghGot.mockReturnValueOnce({
        body: { object: { type: 'tag', url: 'some-url' } },
      });
      ghGot.mockReturnValueOnce({
        body: { object: { type: 'commit', sha: 'ddd111' } },
      });
      const res = await github.getDigest({ lookupName: 'some/dep' }, 'v1.2.0');
      expect(res).toBe('ddd111');
    });
    it('warns if unknown ref', async () => {
      ghGot.mockReturnValueOnce({
        body: { object: { sha: 'ddd111' } },
      });
      const res = await github.getDigest({ lookupName: 'some/dep' }, 'v1.2.0');
      expect(res).toBeNull();
    });
    it('returns null for missed tagged digest', async () => {
      ghGot.mockReturnValueOnce({});
      const res = await github.getDigest({ lookupName: 'some/dep' }, 'v1.2.0');
      expect(res).toBeNull();
    });
  });
  describe('getReleases', () => {
    beforeAll(() => global.renovateCache.rmAll());
    it('returns tags', async () => {
      const body = [{ name: 'v1.0.0' }, { name: 'v1.1.0' }];
      ghGot.mockReturnValueOnce({ headers: {}, body });
      const res = await github.getReleases({
        lookupName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(2);
    });
  });
});
