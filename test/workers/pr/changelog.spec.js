
jest.mock('../../../lib/platform/github/gh-got-wrapper');
jest.mock('../../../lib/datasource/npm');

const ghGot = require('../../../lib/platform/github/gh-got-wrapper');
const npmRegistry = require('../../../lib/datasource/npm');

const changelogHelper = require('../../../lib/workers/pr/changelog');
const { rmAllCache } = require('../../../lib/workers/pr/changelog/source-cache');

describe('workers/pr/changelog', () => {
  describe('getChangeLogJSON', () => {
    beforeEach(async () => {
      npmRegistry.getDependency.mockClear();
      ghGot.mockClear();

      npmRegistry.getDependency.mockReturnValueOnce(Promise.resolve({
        repositoryUrl: "https://github.com/chalk/chalk",
        versions: {
          "0.9.0": {},
          "1.0.0": {gitHead: "npm_1.0.0"},
          "2.3.0": {gitHead: "npm_2.3.0", time: "2017-10-24T03:20:46.238Z"},
          "2.2.2": {gitHead: "npm_2.2.2"},
          "2.4.2": {},
        }
      }));

      await rmAllCache();
    });
    it('returns null if no fromVersion', async () => {
      expect(
        await changelogHelper.getChangeLogJSON('renovate', null, '1.0.0')
      ).toBe(null);
      expect(npmRegistry.getDependency.mock.calls).toHaveLength(0);
      expect(ghGot.mock.calls).toHaveLength(0);
    });
    it('returns null if fromVersion equals newVersion', async () => {
      expect(
        await changelogHelper.getChangeLogJSON('renovate', '1.0.0', '1.0.0')
      ).toBe(null);
      expect(ghGot.mock.calls).toHaveLength(0);
    });
    it('logs when no JSON', async () => {
      // clear the mock
      npmRegistry.getDependency.mockReset();
      expect(
        await changelogHelper.getChangeLogJSON('renovate', '1.0.0', '3.0.0')
      ).toBe(null);
    });
    it('works without Github', async () => {
      expect(
        await changelogHelper.getChangeLogJSON('renovate', '1.0.0', '3.0.0')
      ).toMatchSnapshot();
    });
    it('uses GitHub tags', async () => {
      ghGot.mockReturnValueOnce(Promise.resolve({
        body: [
          { "name": "0.9.0" },
          { "name": "1.0.0" },
          { "name": "1.4.0" },
          { "name": "v2.3.0" },
          { "name": "2.2.2" },
          { "name": "v2.4.2" },
        ],
      }));
      expect(
        await changelogHelper.getChangeLogJSON('renovate', '1.0.0', '3.0.0')
      ).toMatchSnapshot();
    });
    it('returns cached JSON', async () => {
      const first = await changelogHelper.getChangeLogJSON('renovate', '1.0.0', '3.0.0');
      const firstCalls = npmRegistry.getDependency.mock.calls;
      npmRegistry.getDependency.mockClear();
      const second = await changelogHelper.getChangeLogJSON('renovate', '1.0.0', '3.0.0');
      const secondCalls = npmRegistry.getDependency.mock.calls;
      expect(first).toEqual(second);
      expect(firstCalls.length).toBeGreaterThan(secondCalls.length);
      expect(npmRegistry.getDependency.mock.calls).toHaveLength(0);
    });
    it('filters unnecessary warns', async () => {
      ghGot.mockImplementationOnce(() => {
        throw new Error('Unknown Github Repo');
      });
      expect(
        await changelogHelper.getChangeLogJSON('@renovate/no', '1.0.0', '3.0.0')
      ).toMatchSnapshot();
    });
  });
});
