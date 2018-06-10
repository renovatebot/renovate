jest.mock('../../../lib/platform/github/gh-got-wrapper');
jest.mock('../../../lib/datasource/npm');
jest.mock('got');

const ghGot = require('../../../lib/platform/github/gh-got-wrapper');
const got = require('got');

const { getChangeLogJSON } = require('../../../lib/workers/pr/changelog');
const {
  rmAllCache,
} = require('../../../lib/workers/pr/changelog/source-cache');

const upgrade = {
  depName: 'renovate',
  fromVersion: '1.0.0',
  toVersion: '3.0.0',
};

const dependency = {
  repositoryUrl: 'https://github.com/chalk/chalk',
  releases: [
    { version: '0.9.0' },
    { version: '1.0.0', gitHead: 'npm_1.0.0' },
    {
      version: '2.3.0',
      gitHead: 'npm_2.3.0',
      time: '2017-10-24T03:20:46.238Z',
    },
    { version: '2.2.2', gitHead: 'npm_2.2.2' },
    { version: '2.4.2', time: '2017-12-24T03:20:46.238Z' },
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
          ...dependency,
          fromVersion: null,
        })
      ).toBe(null);
      expect(ghGot.mock.calls).toHaveLength(0);
    });
    it('returns null if fromVersion equals toVersion', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          ...dependency,
          fromVersion: '1.0.0',
          toVersion: '1.0.0',
        })
      ).toBe(null);
      expect(ghGot.mock.calls).toHaveLength(0);
    });
    it('logs when no dependency', async () => {
      // clear the mock
      expect(await getChangeLogJSON({ ...upgrade })).toBe(null);
    });
    it('skips invalid repos', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          ...dependency,
          repositoryUrl: 'https://github.com/about',
        })
      ).toBe(null);
    });
    it('works without Github', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          ...dependency,
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
          ...dependency,
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
          ...dependency,
          depName: '@renovate/no',
        })
      ).toMatchSnapshot();
    });
    it('returns cached JSON', async () => {
      const first = await getChangeLogJSON({ ...upgrade });
      ghGot.mockClear();
      const second = await getChangeLogJSON({ ...upgrade });
      expect(first).toEqual(second);
      expect(ghGot.mock.calls).toHaveLength(0);
    });
    it('filters unnecessary warns', async () => {
      ghGot.mockImplementation(() => {
        throw new Error('Unknown Github Repo');
      });
      expect(
        await getChangeLogJSON({
          ...upgrade,
          ...dependency,
          depName: '@renovate/no',
        })
      ).toMatchSnapshot();
    });
    it('skips node engines', async () => {
      expect(await getChangeLogJSON({ ...upgrade, depType: 'engines' })).toBe(
        null
      );
    });
    it('supports github enterprise and github.com changelog', async () => {
      const endpoint = process.env.GITHUB_ENDPOINT;
      process.env.GITHUB_ENDPOINT = 'https://github-enterprise.example.com/';
      expect(
        await getChangeLogJSON({
          ...upgrade,
          ...dependency,
        })
      ).toMatchSnapshot();
      process.env.GITHUB_ENDPOINT = endpoint;
    });
    it('supports github enterprise and github enterprise changelog', async () => {
      const endpoint = process.env.GITHUB_ENDPOINT;
      process.env.GITHUB_ENDPOINT = 'https://github-enterprise.example.com/';
      expect(
        await getChangeLogJSON({
          ...upgrade,
          ...dependency,
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
          ...dependency,
          repositoryUrl: 'https://github-enterprise.example.com/chalk/chalk',
        })
      ).toMatchSnapshot();

      expect(
        await getChangeLogJSON({
          ...upgrade,
          ...dependency,
          repositoryUrl: 'https://github-enterprise.example.com/chalk/chalk',
        })
      ).toMatchSnapshot();
      process.env.GITHUB_ENDPOINT = endpoint;
    });
  });
});
