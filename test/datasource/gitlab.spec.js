const datasource = require('../../lib/datasource');
const gitlab = require('../../lib/datasource/gitlab');
const ghGot = require('../../lib/platform/github/gh-got-wrapper');

jest.mock('../../lib/platform/github/gh-got-wrapper');
jest.mock('got');

describe('datasource/gitlab', () => {
  beforeEach(() => global.renovateCache.rmAll());
  describe('getPreset()', () => {
    it('throws if non-default', async () => {
      await expect(
        gitlab.getPreset('some/repo', 'non-default')
      ).rejects.toThrow();
    });
    it('throws if no content', async () => {
      ghGot.mockImplementationOnce(() => ({
        body: {},
      }));
      await expect(gitlab.getPreset('some/repo')).rejects.toThrow();
    });
    it('throws if fails to parse', async () => {
      ghGot.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('not json').toString('base64'),
        },
      }));
      await expect(gitlab.getPreset('some/repo')).rejects.toThrow();
    });
    it('should return the preset', async () => {
      ghGot.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('{"foo":"bar"}').toString('base64'),
        },
      }));
      const content = await gitlab.getPreset('some/repo');
      expect(content).toEqual({ foo: 'bar' });
    });
  });
  describe('getPkgReleases', () => {
    beforeAll(() => global.renovateCache.rmAll());
    it('returns null for invalid ref', async () => {
      expect(
        await datasource.getPkgReleases('pkg:github/some/dep?ref=invalid')
      ).toBeNull();
    });
  });
});
