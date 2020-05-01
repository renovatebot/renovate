import { mocked } from '../../../test/util';
import _got from '../../util/got';

import * as _hostRules from '../../util/host-rules';
import * as github from '.';

jest.mock('../../util/got');
jest.mock('../../util/host-rules');

const got: any = mocked(_got);
const hostRules: any = mocked(_hostRules);

describe('datasource/github-tags', () => {
  beforeEach(() => global.renovateCache.rmAll());
  describe('getDigest', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.hosts = jest.fn(() => []);
      return global.renovateCache.rmAll();
    });
    it('returns null if no token', async () => {
      got.mockReturnValueOnce({ body: [] });
      const res = await github.getDigest({ lookupName: 'some/dep' }, null);
      expect(res).toBeNull();
    });
    it('returns digest', async () => {
      got.mockReturnValueOnce({ body: [{ sha: 'abcdef' }] });
      const res = await github.getDigest({ lookupName: 'some/dep' }, null);
      expect(res).toBe('abcdef');
    });
    it('returns commit digest', async () => {
      got.mockReturnValueOnce({
        body: { object: { type: 'commit', sha: 'ddd111' } },
      });
      const res = await github.getDigest({ lookupName: 'some/dep' }, 'v1.2.0');
      expect(res).toBe('ddd111');
    });
    it('returns tagged commit digest', async () => {
      got.mockReturnValueOnce({
        body: { object: { type: 'tag', url: 'some-url' } },
      });
      got.mockReturnValueOnce({
        body: { object: { type: 'commit', sha: 'ddd111' } },
      });
      const res = await github.getDigest({ lookupName: 'some/dep' }, 'v1.2.0');
      expect(res).toBe('ddd111');
    });
    it('warns if unknown ref', async () => {
      got.mockReturnValueOnce({
        body: { object: { sha: 'ddd111' } },
      });
      const res = await github.getDigest({ lookupName: 'some/dep' }, 'v1.2.0');
      expect(res).toBeNull();
    });
    it('returns null for missed tagged digest', async () => {
      got.mockReturnValueOnce({});
      const res = await github.getDigest({ lookupName: 'some/dep' }, 'v1.2.0');
      expect(res).toBeNull();
    });
  });
  describe('getReleases', () => {
    beforeAll(() => global.renovateCache.rmAll());
    it('returns tags', async () => {
      const body = [{ name: 'v1.0.0' }, { name: 'v1.1.0' }];
      got.mockReturnValueOnce({ headers: {}, body });
      const res = await github.getReleases({
        lookupName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(2);
    });
  });
});
