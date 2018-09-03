const datasource = require('../../lib/datasource');
const github = require('../../lib/datasource/github');
const ghGot = require('../../lib/platform/github/gh-got-wrapper');

jest.mock('../../lib/platform/github/gh-got-wrapper');
jest.mock('got');

describe('datasource/github', () => {
  beforeEach(() => global.renovateCache.rmAll());
  describe('getPreset()', () => {
    it('throws if non-default', async () => {
      await expect(
        github.getPreset('some/repo', 'non-default')
      ).rejects.toThrow();
    });
    it('throws if no content', async () => {
      ghGot.mockImplementationOnce(() => ({
        body: {},
      }));
      await expect(github.getPreset('some/repo')).rejects.toThrow();
    });
    it('throws if fails to parse', async () => {
      ghGot.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('not json').toString('base64'),
        },
      }));
      await expect(github.getPreset('some/repo')).rejects.toThrow();
    });
    it('should return the preset', async () => {
      ghGot.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('{"foo":"bar"}').toString('base64'),
        },
      }));
      const content = await github.getPreset('some/repo');
      expect(content).toEqual({ foo: 'bar' });
    });
  });
  describe('getPkgReleases', () => {
    beforeAll(() => global.renovateCache.rmAll());
    it('returns cleaned tags', async () => {
      const body = [
        { name: 'a' },
        { name: 'v' },
        { name: '1.0.0' },
        { name: 'v1.1.0' },
      ];
      ghGot.mockReturnValueOnce({ headers: {}, body });
      const res = await datasource.getPkgReleases(
        'pkg:github/some/dep?sanitize=true'
      );
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(2);
      expect(
        res.releases.find(release => release.version === '1.1.0')
      ).toBeDefined();
    });
    it('returns releases', async () => {
      const body = [
        { tag_name: 'a' },
        { tag_name: 'v' },
        { tag_name: '1.0.0' },
        { tag_name: 'v1.1.0' },
      ];
      ghGot.mockReturnValueOnce({ headers: {}, body });
      const res = await datasource.getPkgReleases(
        'pkg:github/some/dep?ref=release'
      );
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(2);
      expect(
        res.releases.find(release => release.version === 'v1.1.0')
      ).toBeDefined();
    });
    it('returns releases from cache', async () => {
      const body = [
        { tag_name: 'a' },
        { tag_name: 'v' },
        { tag_name: '1.0.0' },
        { tag_name: 'v1.1.0' },
      ];
      ghGot.mockReturnValueOnce({ headers: {}, body });
      const res1 = await datasource.getPkgReleases(
        'pkg:github/some/dep-to-cache?ref=release'
      );
      expect(res1.releases).toHaveLength(2);
      const res2 = await datasource.getPkgReleases(
        'pkg:github/some/dep-to-cache?ref=release'
      );
      expect(res1).toEqual(res2);
    });
    it('returns null for invalid ref', async () => {
      expect(
        await datasource.getPkgReleases('pkg:github/some/dep?ref=invalid')
      ).toBeNull();
    });
  });
});
