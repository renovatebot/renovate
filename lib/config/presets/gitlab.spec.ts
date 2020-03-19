import * as gitlab from './gitlab';
import { api } from '../../platform/gitlab/gl-got-wrapper';
import { GotResponse } from '../../platform';

jest.mock('../../platform/gitlab/gl-got-wrapper');
jest.mock('../../util/got');

const glGot: jest.Mock<Promise<Partial<GotResponse>>> = api.get as never;

describe('config/presets/gitlab', () => {
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
      glGot.mockResolvedValueOnce({
        body: {},
      });
      await expect(gitlab.getPreset('some/repo')).rejects.toThrow();
    });
    it('throws if fails to parse', async () => {
      glGot.mockResolvedValueOnce({
        body: {
          content: Buffer.from('not json').toString('base64'),
        },
      });
      await expect(gitlab.getPreset('some/repo')).rejects.toThrow();
    });
    it('should return the preset', async () => {
      glGot.mockResolvedValueOnce({
        body: [
          {
            name: 'devel',
          },
          {
            name: 'master',
            default: true,
          },
        ],
      });
      glGot.mockResolvedValueOnce({
        body: {
          content: Buffer.from('{"foo":"bar"}').toString('base64'),
        },
      });
      const content = await gitlab.getPreset('some/repo');
      expect(content).toEqual({ foo: 'bar' });
    });
  });
});
