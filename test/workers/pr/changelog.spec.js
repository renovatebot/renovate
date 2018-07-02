jest.mock('../../../lib/platform/github/gh-got-wrapper');
jest.mock('../../../lib/datasource/npm');
jest.mock('got');

const ghGot = require('../../../lib/platform/github/gh-got-wrapper');

const { getChangeLogJSON } = require('../../../lib/workers/pr/changelog');
const {
  rmAllCache,
} = require('../../../lib/workers/pr/changelog/source-cache');

const upgrade = {
  depName: 'renovate',
  versionScheme: 'semver',
  fromVersion: '1.0.0',
  toVersion: '3.0.0',
  repositoryUrl: 'https://github.com/chalk/chalk',
  releases: [
    { version: '0.9.0' },
    { version: '1.0.0', gitRef: 'npm_1.0.0' },
    {
      version: '2.3.0',
      gitRef: 'npm_2.3.0',
      releaseTimestamp: '2017-10-24T03:20:46.238Z',
    },
    { version: '2.2.2', gitRef: 'npm_2.2.2' },
    { version: '2.4.2', releaseTimestamp: '2017-12-24T03:20:46.238Z' },
    { version: '2.5.2' },
  ],
};

describe('workers/pr/changelog', () => {
  describe('getChangeLogJSON', () => {
    beforeEach(async () => {
      ghGot.mockClear();

      await rmAllCache();
    });
    it('returns null if no fromVersion', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          fromVersion: null,
        })
      ).toBe(null);
      expect(ghGot.mock.calls).toHaveLength(0);
    });
    it('returns null if fromVersion equals toVersion', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          fromVersion: '1.0.0',
          toVersion: '1.0.0',
        })
      ).toBe(null);
      expect(ghGot.mock.calls).toHaveLength(0);
    });
    it('skips invalid repos', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          repositoryUrl: 'https://github.com/about',
        })
      ).toBe(null);
    });
    it('works without Github', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot();
    });
    it('uses GitHub tags', async () => {
      ghGot.mockReturnValueOnce(
        Promise.resolve({
          body: [
            { name: '0.9.0' },
            { name: '1.0.0' },
            { name: '1.4.0' },
            { name: 'v2.3.0' },
            { name: '2.2.2' },
            { name: 'v2.4.2' },
          ],
        })
      );
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot();
    });
    it('falls back to commit from release time', async () => {
      // mock tags response
      ghGot.mockReturnValueOnce(Promise.resolve());
      // mock commit time response
      ghGot.mockReturnValue(
        Promise.resolve({
          body: { sha: 'sha_from_time' },
        })
      );
      expect(
        await getChangeLogJSON({
          ...upgrade,
          depName: '@renovate/no',
        })
      ).toMatchSnapshot();
    });
    it('returns cached JSON', async () => {
      const first = await getChangeLogJSON({ ...upgrade });
      const firstCalls = [...ghGot.mock.calls];
      ghGot.mockClear();
      const second = await getChangeLogJSON({ ...upgrade });
      const secondCalls = [...ghGot.mock.calls];
      expect(first).toEqual(second);
      expect(firstCalls.length).toBeGreaterThan(secondCalls.length);
    });
    it('filters unnecessary warns', async () => {
      ghGot.mockImplementation(() => {
        throw new Error('Unknown Github Repo');
      });
      expect(
        await getChangeLogJSON({
          ...upgrade,
          depName: '@renovate/no',
        })
      ).toMatchSnapshot();
    });
    it('supports node engines', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          depType: 'engines',
        })
      ).toMatchSnapshot();
    });
    it('handles no repositoryUrl', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          repositoryUrl: undefined,
        })
      ).toBe(null);
    });
    it('handles invalid repositoryUrl', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          repositoryUrl: 'http://example.com',
        })
      ).toBe(null);
    });
    it('handles no releases', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          releases: [],
        })
      ).toBe(null);
    });
    it('handles not enough releases', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          releases: [{ version: '0.9.0' }],
        })
      ).toBe(null);
    });
    it('supports github enterprise and github.com changelog', async () => {
      const token = process.env.GITHUB_TOKEN;
      const endpoint = process.env.GITHUB_ENDPOINT;
      process.env.GITHUB_TOKEN = 'super_secret';
      process.env.GITHUB_ENDPOINT = 'https://github-enterprise.example.com/';
      const oldenv = { ...process.env };
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot();
      // check that process env was restored
      expect(process.env).toEqual(oldenv);
      process.env.GITHUB_TOKEN = token;
      process.env.GITHUB_ENDPOINT = endpoint;
    });
    it('supports github enterprise and github enterprise changelog', async () => {
      const endpoint = process.env.GITHUB_ENDPOINT;
      process.env.GITHUB_ENDPOINT = 'https://github-enterprise.example.com/';
      expect(
        await getChangeLogJSON({
          ...upgrade,
          repositoryUrl: 'https://github-enterprise.example.com/chalk/chalk',
        })
      ).toMatchSnapshot();

      process.env.GITHUB_ENDPOINT = endpoint;
    });

    it('supports github enterprise alwo when retrieving data from cache', async () => {
      const endpoint = process.env.GITHUB_ENDPOINT;
      process.env.GITHUB_ENDPOINT = 'https://github-enterprise.example.com/';
      expect(
        await getChangeLogJSON({
          ...upgrade,
          repositoryUrl: 'https://github-enterprise.example.com/chalk/chalk',
        })
      ).toMatchSnapshot();

      expect(
        await getChangeLogJSON({
          ...upgrade,
          repositoryUrl: 'https://github-enterprise.example.com/chalk/chalk',
        })
      ).toMatchSnapshot();
      process.env.GITHUB_ENDPOINT = endpoint;
    });
  });
});
