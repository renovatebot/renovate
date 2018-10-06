jest.mock('../../../../lib/platform/github/gh-got-wrapper');
jest.mock('../../../../lib/datasource/npm');
jest.mock('got');

const hostRules = require('../../../../lib/util/host-rules');
const ghGot = require('../../../../lib/platform/github/gh-got-wrapper');

const { getChangeLogJSON } = require('../../../../lib/workers/pr/changelog');
const releaseNotes = require('../../../../lib/workers/pr/changelog/release-notes');

releaseNotes.addReleaseNotes = jest.fn(input => input);

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
      hostRules.clear();
      hostRules.update({
        platform: 'github',
        endpoint: 'https://api.github.com/',
      });
      await global.renovateCache.rmAll();
    });
    it('returns null if @types', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          fromVersion: null,
        })
      ).toBe(null);
      expect(ghGot.mock.calls).toHaveLength(0);
    });
    it('returns null if no fromVersion', async () => {
      expect(
        await getChangeLogJSON({
          ...upgrade,
          repositoryUrl: 'https://github.com/DefinitelyTyped/DefinitelyTyped',
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
    it('returns cached JSON', async () => {
      ghGot.mockClear();
      const first = await getChangeLogJSON({ ...upgrade });
      const firstCallsCount = ghGot.mock.calls.length;
      const second = await getChangeLogJSON({ ...upgrade });
      const secondCallsCount = ghGot.mock.calls.length - firstCallsCount;
      expect(first).toEqual(second);
      expect(firstCallsCount).toBeGreaterThan(secondCallsCount);
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
      hostRules.update({
        platform: 'github',
        token: 'super_secret',
        endpoint: 'https://github-enterprise.example.com/',
      });
      expect(
        await getChangeLogJSON({
          ...upgrade,
        })
      ).toMatchSnapshot();
    });
    it('supports github enterprise and github enterprise changelog', async () => {
      hostRules.update({
        platform: 'github',
        endpoint: 'https://github-enterprise.example.com/',
      });
      process.env.GITHUB_ENDPOINT = '';
      expect(
        await getChangeLogJSON({
          ...upgrade,
          repositoryUrl: 'https://github-enterprise.example.com/chalk/chalk',
        })
      ).toMatchSnapshot();
    });

    it('supports github enterprise alwo when retrieving data from cache', async () => {
      hostRules.update({
        platform: 'github',
        endpoint: 'https://github-enterprise.example.com/',
      });
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
    });
  });
});
