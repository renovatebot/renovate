const datasource = require('../../lib/datasource');
const github = require('../../lib/datasource/github');
const ghGot = require('../../lib/platform/github/gh-got-wrapper');
const got = require('../../lib/util/got');
const hostRules = require('../../lib/util/host-rules');

jest.mock('../../lib/platform/github/gh-got-wrapper');
jest.mock('../../lib/util/got');
jest.mock('../../lib/util/host-rules');

describe('datasource/github', () => {
  beforeEach(() => global.renovateCache.rmAll());
  describe('getDigest', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      global.repoCache = {};
      return global.renovateCache.rmAll();
    });
    it('returns null if no token', async () => {
      ghGot.mockReturnValueOnce({ body: [] });
      const res = await github.getDigest(
        { depName: 'some-dep', githubRepo: 'some/dep' },
        null
      );
      expect(res).toBeNull();
    });
    it('returns digest', async () => {
      ghGot.mockReturnValueOnce({ body: [{ sha: 'abcdef' }] });
      const res = await github.getDigest(
        { depName: 'some-dep', lookupName: 'some/dep' },
        null
      );
      expect(res).toBe('abcdef');
    });
    it('returns commit digest', async () => {
      ghGot.mockReturnValueOnce({
        body: { object: { type: 'commit', sha: 'ddd111' } },
      });
      const res = await github.getDigest(
        { depName: 'some-dep', lookupName: 'some/dep' },
        'v1.2.0'
      );
      expect(res).toBe('ddd111');
    });
    it('returns tagged commit digest', async () => {
      ghGot.mockReturnValueOnce({
        body: { object: { type: 'tag', url: 'some-url' } },
      });
      ghGot.mockReturnValueOnce({
        body: { object: { type: 'commit', sha: 'ddd111' } },
      });
      const res = await github.getDigest(
        { depName: 'some-dep', lookupName: 'some/dep' },
        'v1.2.0'
      );
      expect(res).toBe('ddd111');
    });
    it('warns if unknown ref', async () => {
      ghGot.mockReturnValueOnce({
        body: { object: { sha: 'ddd111' } },
      });
      const res = await github.getDigest(
        { depName: 'some-dep', lookupName: 'some/dep' },
        'v1.2.0'
      );
      expect(res).toBeNull();
    });
    it('returns null for missed tagged digest', async () => {
      ghGot.mockReturnValueOnce({});
      const res = await github.getDigest(
        { depName: 'some-dep', lookupName: 'some/dep' },
        'v1.2.0'
      );
      expect(res).toBeNull();
    });
  });
  describe('getPreset()', () => {
    it('tries default then renovate', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      await expect(github.getPreset('some/repo')).rejects.toThrow();
    });
    it('throws if no content', async () => {
      got.mockImplementationOnce(() => ({
        body: {},
      }));
      await expect(github.getPreset('some/repo')).rejects.toThrow();
    });
    it('throws if fails to parse', async () => {
      got.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('not json').toString('base64'),
        },
      }));
      await expect(github.getPreset('some/repo')).rejects.toThrow();
    });
    it('should return default.json', async () => {
      hostRules.find.mockReturnValueOnce({ token: 'abc' });
      got.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('{"foo":"bar"}').toString('base64'),
        },
      }));
      const content = await github.getPreset('some/repo');
      expect(content).toEqual({ foo: 'bar' });
    });
    it('should return custom.json', async () => {
      hostRules.find.mockReturnValueOnce({ token: 'abc' });
      got.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('{"foo":"bar"}').toString('base64'),
        },
      }));
      try {
        global.appMode = true;
        const content = await github.getPreset('some/repo', 'custom');
        expect(content).toEqual({ foo: 'bar' });
      } finally {
        delete global.appMode;
      }
    });
  });
  describe('getPkgReleases', () => {
    beforeAll(() => global.renovateCache.rmAll());
    it('returns releases', async () => {
      const body = [
        { tag_name: 'a' },
        { tag_name: 'v' },
        { tag_name: '1.0.0' },
        { tag_name: 'v1.1.0' },
      ];
      ghGot.mockReturnValueOnce({ headers: {}, body });
      const res = await datasource.getPkgReleases({
        datasource: 'github',
        depName: 'some/dep',
        lookupType: 'releases',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(2);
      expect(
        res.releases.find(release => release.version === 'v1.1.0')
      ).toBeDefined();
    });
    it('returns tags', async () => {
      const body = [{ name: 'v1.0.0' }, { name: 'v1.1.0' }];
      ghGot.mockReturnValueOnce({ headers: {}, body });
      const res = await datasource.getPkgReleases({
        datasource: 'github',
        depName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(2);
    });
  });
});
