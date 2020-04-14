import * as gitlab from './gitlab';
import { api } from '../../platform/gitlab/gl-got-wrapper';
import { GotResponse } from '../../platform';

jest.mock('../../platform/gitlab/gl-got-wrapper');
jest.mock('../../util/got');

const glGot: jest.Mock<Promise<Partial<GotResponse>>> = api.get as never;

describe('config/presets/gitlab', () => {
  beforeEach(() => {
    glGot.mockReset();
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
    it('uses default endpoint', async () => {
      await gitlab.getPreset('some/repo', 'default').catch(_ => {});
      expect(glGot.mock.calls[0][0]).toEqual(
        'https://gitlab.com/api/v4/projects/some%2Frepo/repository/branches'
      );
    });
    it('uses custom endpoint', async () => {
      await gitlab
        .getPreset('some/repo', 'default', {
          endpoint: 'https://gitlab.example.org/api/v4',
        })
        .catch(_ => {});
      expect(glGot.mock.calls[0][0]).toEqual(
        'https://gitlab.example.org/api/v4/projects/some%2Frepo/repository/branches'
      );
    });
  });
});
