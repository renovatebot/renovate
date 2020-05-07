import { PLATFORM_FAILURE } from '../../constants/error-messages';
import { GotResponse } from '../../platform';
import { api } from '../../platform/gitlab/gl-got-wrapper';
import { clearRepoCache } from '../../util/cache';
import * as gitlab from './gitlab';
import { PartialDeep } from 'type-fest';

jest.mock('../../platform/gitlab/gl-got-wrapper');
jest.mock('../../util/got');

const glGot: jest.Mock<Promise<PartialDeep<GotResponse>>> = api.get as never;
const branchesResponse = {
  body: [
    {
      name: 'devel',
    },
    {
      name: 'master',
      default: true,
    },
  ],
};

describe('config/presets/gitlab', () => {
  beforeEach(() => {
    glGot.mockReset();
    glGot.mockResolvedValueOnce(branchesResponse);
    return global.renovateCache.rmAll();
  });
  describe('fetchJSONFile()', () => {
    beforeEach(() => {
      clearRepoCache();
    });
    it('returns JSON', async () => {
      glGot.mockResolvedValue({
        body: {
          content: Buffer.from('{"from":"api"}').toString('base64'),
        },
      });
      const res = await gitlab.fetchJSONFile(
        'some/repo',
        'some-filename',
        'https://gitlab.example.org/api/v4'
      );
      expect(res).toMatchSnapshot();
    });
  });
  describe('getPreset()', () => {
    it('passes up platform-failure', async () => {
      glGot.mockImplementation(() => {
        throw new Error(PLATFORM_FAILURE);
      });
      await expect(gitlab.getPreset('some/repo')).rejects.toThrow(
        PLATFORM_FAILURE
      );
    });
    it('tries default then renovate', async () => {
      glGot.mockImplementation(() => {
        throw new Error();
      });
      await expect(gitlab.getPreset('some/repo')).rejects.toThrow();
    });
    it('throws if no content', async () => {
      glGot.mockResolvedValue({
        body: {},
      });
      await expect(gitlab.getPreset('some/repo')).rejects.toThrow();
    });
    it('throws if fails to parse', async () => {
      glGot.mockResolvedValue({
        body: {
          content: Buffer.from('not json').toString('base64'),
        },
      });
      await expect(gitlab.getPreset('some/repo')).rejects.toThrow();
    });
    it('should return default.json', async () => {
      glGot.mockResolvedValue({
        body: {
          content: Buffer.from('{"foo":"bar"}').toString('base64'),
        },
      });
      const content = await gitlab.getPreset('some/repo');
      expect(content).toEqual({ foo: 'bar' });
    });
    it('should query preset within the file', async () => {
      glGot.mockResolvedValue({
        body: {
          content: Buffer.from('{"somename":{"foo":"bar"}}').toString('base64'),
        },
      });
      const content = await gitlab.getPreset('some/repo', 'somefile/somename');
      expect(content).toEqual({ foo: 'bar' });
    });
    it('should query subpreset', async () => {
      glGot
        .mockResolvedValueOnce({
          body: {
            content: Buffer.from(
              '{"somename":{"somesubname":{"foo":"bar"}}}'
            ).toString('base64'),
          },
        })
        .mockResolvedValueOnce(branchesResponse)
        .mockResolvedValueOnce({
          body: {
            content: Buffer.from(
              '{"somename":{"somesubname":{"foo":"bar"}}}'
            ).toString('base64'),
          },
        });
      let content = await gitlab.getPreset(
        'some/repo',
        'somefile/somename/somesubname'
      );
      expect(content).toEqual({ foo: 'bar' });
      content = await gitlab.getPreset(
        'some/repo',
        'somefile/wrongname/somesubname'
      );
      expect(content).toBeUndefined();
    });
    it('should return custom.json', async () => {
      glGot.mockResolvedValue({
        body: {
          content: Buffer.from('{"foo":"bar"}').toString('base64'),
        },
      });
      try {
        global.appMode = true;
        const content = await gitlab.getPreset('some/repo', 'custom');
        expect(content).toEqual({ foo: 'bar' });
      } finally {
        delete global.appMode;
      }
    });
    it('should return the preset', async () => {
      glGot.mockResolvedValue({
        body: {
          content: Buffer.from('{"foo":"bar"}').toString('base64'),
        },
      });
      const content = await gitlab.getPreset('some/repo');
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
