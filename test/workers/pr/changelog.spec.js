jest.mock('../../../lib/platform/github/gh-got-wrapper');
jest.mock('../../../lib/datasource/npm');
jest.mock('got');

const ghGot = require('../../../lib/platform/github/gh-got-wrapper');
const npmRegistry = require('../../../lib/datasource/npm');
const got = require('got');

const { getChangeLogJSON } = require('../../../lib/workers/pr/changelog');
const {
  rmAllCache,
} = require('../../../lib/workers/pr/changelog/source-cache');

const upgrade = {
  manager: 'npm',
  depName: 'renovate',
  fromVersion: '1.0.0',
  newValue: '3.0.0',
};

function npmResponse() {
  return {
    repositoryUrl: 'https://github.com/chalk/chalk',
    versions: {
      '0.9.0': {},
      '1.0.0': { gitHead: 'npm_1.0.0' },
      '2.3.0': { gitHead: 'npm_2.3.0', time: '2017-10-24T03:20:46.238Z' },
      '2.2.2': { gitHead: 'npm_2.2.2' },
      '2.4.2': { time: '2017-12-24T03:20:46.238Z' },
      '2.5.2': {},
    },
  };
}

function pipResponse() {
  return {
    info: {
      home_page: 'https://github.com/chalk/chalk',
    },
    releases: {
      '0.9.0': [],
      '1.0.0': [],
      '2.3.0': [{ upload_time: '2017-10-24T03:20:46.238Z' }],
      '2.2.2': [{}],
      '2.4.2': [{ upload_time: '2017-12-24T03:20:46.238Z' }],
      '2.5.2': [],
    },
  };
}

describe('workers/pr/changelog', () => {
  describe('getChangeLogJSON', () => {
    beforeEach(async () => {
      npmRegistry.getDependency.mockClear();
      ghGot.mockClear();

      npmRegistry.getDependency.mockReturnValueOnce(
        Promise.resolve(npmResponse())
      );

      await rmAllCache();
    });
    it('returns null if no fromVersion', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          fromVersion: null,
        })
      ).toBe(null);
      expect(npmRegistry.getDependency.mock.calls).toHaveLength(0);
      expect(ghGot.mock.calls).toHaveLength(0);
    });
    it('returns null if fromVersion equals newValue', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          fromVersion: '1.0.0',
          newValue: '1.0.0',
        })
      ).toBe(null);
      expect(ghGot.mock.calls).toHaveLength(0);
    });
    it('logs when no JSON', async () => {
      // clear the mock
      npmRegistry.getDependency.mockReset();
      expect(await getChangeLogJSON({ ...upgrade })).toBe(null);
    });
    it('skips invalid repos', async () => {
      // clear the mock
      npmRegistry.getDependency.mockReset();
      const res = npmResponse();
      res.repositoryUrl = 'https://github.com/about';
      npmRegistry.getDependency.mockReturnValueOnce(Promise.resolve(res));
      expect(await getChangeLogJSON({ ...upgrade })).toBe(null);
    });
    it('works without Github', async () => {
      expect(await getChangeLogJSON({ ...upgrade })).toMatchSnapshot();
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
      expect(await getChangeLogJSON({ ...upgrade })).toMatchSnapshot();
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
      npmRegistry.getDependency.mockClear();
      const second = await getChangeLogJSON({ ...upgrade });
      expect(first).toEqual(second);
      expect(npmRegistry.getDependency.mock.calls).toHaveLength(0);
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
    it('skips node engines', async () => {
      expect(await getChangeLogJSON({ ...upgrade, depType: 'engines' })).toBe(
        null
      );
    });
    it('supports pip', async () => {
      got.mockReturnValueOnce(
        Promise.resolve({
          body: pipResponse(),
        })
      );
      expect(
        await getChangeLogJSON({ ...upgrade, manager: 'pip_requirements' })
      ).toMatchSnapshot();
    });
    it('works without pip', async () => {
      expect(
        await getChangeLogJSON({ ...upgrade, manager: 'pip_requirements' })
      ).toBe(null);
    });
    it('handles pip errors', async () => {
      got.mockImplementation(() => {
        throw new Error('Unknown Pip Repo');
      });
      expect(
        await getChangeLogJSON({ ...upgrade, manager: 'pip_requirements' })
      ).toBe(null);
    });
    it('supports github enterprise and github.com changelog', async () => {
      // clear the mock
      npmRegistry.getDependency.mockReset();
      const res = npmResponse();
      npmRegistry.getDependency.mockReturnValueOnce(Promise.resolve(res));

      const endpoint = process.env.GITHUB_ENDPOINT;
      process.env.GITHUB_ENDPOINT = 'https://github-enterprise.example.com/';
      expect(await getChangeLogJSON({ ...upgrade })).toMatchSnapshot();

      process.env.GITHUB_ENDPOINT = endpoint;
    });
    it('supports github enterprise and github enterprise changelog', async () => {
      // clear the mock
      npmRegistry.getDependency.mockReset();
      const res = npmResponse();
      res.repositoryUrl = 'https://github-enterprise.example.com/chalk/chalk';
      npmRegistry.getDependency.mockReturnValueOnce(Promise.resolve(res));

      const endpoint = process.env.GITHUB_ENDPOINT;
      process.env.GITHUB_ENDPOINT = 'https://github-enterprise.example.com/';
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot();

      process.env.GITHUB_ENDPOINT = endpoint;
    });

    it('supports github enterprise alwo when retrieving data from cache', async () => {
      // clear the mock
      npmRegistry.getDependency.mockReset();
      const res = npmResponse();
      res.repositoryUrl = 'https://github-enterprise.example.com/chalk/chalk';
      npmRegistry.getDependency.mockReturnValueOnce(Promise.resolve(res));

      const endpoint = process.env.GITHUB_ENDPOINT;
      process.env.GITHUB_ENDPOINT = 'https://github-enterprise.example.com/';
      expect(await getChangeLogJSON({ ...upgrade })).toMatchSnapshot();

      expect(await getChangeLogJSON({ ...upgrade })).toMatchSnapshot();
      process.env.GITHUB_ENDPOINT = endpoint;
    });
  });
});
