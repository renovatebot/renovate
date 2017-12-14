const bazel = require('../../../lib/manager/bazel/package');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const ghGot = require('../../../lib/platform/github/gh-got-wrapper');

jest.mock('../../../lib/platform/github/gh-got-wrapper');

describe('lib/workers/package/bazel', () => {
  describe('getPackageUpdates', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
      };
    });
    it('returns empty if remote is not github', async () => {
      config.depType = 'git_repository';
      config.remote = 'https://gitlab.com/a/b.git';
      expect(await bazel.getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if current version is not valid semver', async () => {
      config.depType = 'git_repository';
      config.remote = 'https://github.com/a/b.git';
      config.currentVersion = 'latest';
      expect(await bazel.getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if no newer version', async () => {
      config.depType = 'git_repository';
      config.remote = 'https://github.com/a/b.git';
      config.currentVersion = '1.0.0';
      ghGot.mockReturnValueOnce({
        body: [
          {
            ref: 'refs/tags/0.9.0',
          },
          {
            ref: 'refs/tags/1.0.0',
          },
        ],
      });
      expect(await bazel.getPackageUpdates(config)).toEqual([]);
    });
    it('returns result if newer version', async () => {
      config.depType = 'git_repository';
      config.remote = 'https://github.com/a/b.git';
      config.currentVersion = '1.0.0';
      ghGot.mockReturnValueOnce({
        body: [
          {
            ref: 'refs/tags/0.9.0',
          },
          {
            ref: 'refs/tags/1.0.0',
          },
          {
            ref: 'refs/tags/1.1.0',
          },
          {
            ref: 'refs/tags/1.1.1',
          },
        ],
      });
      expect(await bazel.getPackageUpdates(config)).toMatchSnapshot();
    });
    it('returns major result', async () => {
      config.depType = 'git_repository';
      config.remote = 'https://github.com/a/b.git';
      config.currentVersion = '1.0.0';
      ghGot.mockReturnValueOnce({
        body: [
          {
            ref: 'refs/tags/1.0.0',
          },
          {
            ref: 'refs/tags/2.0.0',
          },
        ],
      });
      expect(await bazel.getPackageUpdates(config)).toMatchSnapshot();
    });
    it('returns http archive result', async () => {
      config.depType = 'http_archive';
      config.repo = 'a/b';
      config.currentVersion = '0.7.1';
      ghGot.mockReturnValueOnce({
        body: [
          {
            tag_name: '0.7.0',
          },
          {
            tag_name: '0.7.1',
          },
          {
            tag_name: '0.8.0',
          },
          {
            tag_name: '0.8.1',
          },
        ],
      });
      expect(await bazel.getPackageUpdates(config)).toMatchSnapshot();
    });
    it('warns for invalid semver', async () => {
      config.depType = 'http_archive';
      config.repo = 'a/b';
      config.currentVersion = 'foo';
      expect(await bazel.getPackageUpdates(config)).toEqual([]);
    });
  });
});
