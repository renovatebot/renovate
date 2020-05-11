import { GotResponse } from '../../../platform';
import { api } from '../../../platform/gitlab/gl-got-wrapper';
import * as globalCache from '../../../util/cache/global';
import * as gitlab from '.';
import { PartialDeep } from 'type-fest';

jest.mock('../../../platform/gitlab/gl-got-wrapper');
jest.mock('../../../util/got');

const glGot: jest.Mock<Promise<PartialDeep<GotResponse>>> = api.get as never;

describe('config/presets/gitlab', () => {
  beforeEach(() => {
    glGot.mockReset();
    return globalCache.rmAll();
  });
  describe('getPreset()', () => {
    it('throws if non-default', async () => {
      await expect(
        gitlab.getPreset({
          packageName: 'some/repo',
          presetName: 'non-default',
        })
      ).rejects.toThrow();
    });
    it('throws if no content', async () => {
      glGot.mockResolvedValueOnce({
        body: {},
      });
      await expect(
        gitlab.getPreset({ packageName: 'some/repo' })
      ).rejects.toThrow();
    });
    it('throws if fails to parse', async () => {
      glGot.mockResolvedValueOnce({
        body: {
          content: Buffer.from('not json').toString('base64'),
        },
      });
      await expect(
        gitlab.getPreset({ packageName: 'some/repo' })
      ).rejects.toThrow();
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
      const content = await gitlab.getPreset({ packageName: 'some/repo' });
      expect(content).toEqual({ foo: 'bar' });
    });
  });
  describe('getPresetFromEndpoint()', () => {
    it('uses custom endpoint', async () => {
      await gitlab
        .getPresetFromEndpoint(
          'some/repo',
          'default',
          'https://gitlab.example.org/api/v4'
        )
        .catch((_) => {});
      expect(glGot.mock.calls[0][0]).toEqual(
        'https://gitlab.example.org/api/v4/projects/some%2Frepo/repository/branches'
      );
    });
  });
});
