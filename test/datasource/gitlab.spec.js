const datasource = require('../../lib/datasource');
const gitlab = require('../../lib/datasource/gitlab');
const glGot = require('../../lib/platform/gitlab/gl-got-wrapper');

jest.mock('../../lib/platform/gitlab/gl-got-wrapper');
jest.mock('got');

describe('datasource/gitlab', () => {
  beforeEach(() => {
    global.repoCache = {};
    return global.renovateCache.rmAll();
  });
  describe('getPreset()', () => {
    it('throws if non-default', async () => {
      await expect(
        gitlab.getPreset('some/repo', 'non-default')
      ).rejects.toThrow();
    });
    it('throws if no content', async () => {
      glGot.mockImplementationOnce(() => ({
        body: {},
      }));
      await expect(gitlab.getPreset('some/repo')).rejects.toThrow();
    });
    it('throws if fails to parse', async () => {
      glGot.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('not json').toString('base64'),
        },
      }));
      await expect(gitlab.getPreset('some/repo')).rejects.toThrow();
    });
    it('should return the preset', async () => {
      glGot.mockImplementationOnce(() => ({
        body: [
          {
            name: 'master',
            default: true,
          },
        ],
      }));
      glGot.mockImplementationOnce(() => ({
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
