import { PartialDeep } from 'type-fest';
import * as github from './github';
import _got from '../../util/got';
import * as _hostRules from '../../util/host-rules';
import { PLATFORM_FAILURE } from '../../constants/error-messages';
import { mocked } from '../../../test/util';
import { GotResponse } from '../../platform';
import { clearRepoCache } from '../../util/cache';

jest.mock('../../platform/github/gh-got-wrapper');
jest.mock('../../util/got');
jest.mock('../../util/host-rules');

const got: jest.Mock<PartialDeep<GotResponse>> = _got as never;
const hostRules = mocked(_hostRules);

describe('config/presets/github', () => {
  beforeEach(() => {
    got.mockReset();
    return global.renovateCache.rmAll();
  });
  describe('setInternalPreset()', () => {
    it('allows override', () => {
      github.setInternalPreset({ body: {} });
    });
  });
  describe('fetchJSONFile()', () => {
    beforeEach(() => {
      clearRepoCache();
    });
    it('returns JSON', async () => {
      hostRules.find.mockReturnValueOnce({ token: 'abc' });
      got.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('{"from":"api"}').toString('base64'),
        },
      }));
      const res = await github.fetchJSONFile(
        'some/repo',
        'some-filename',
        'https://api.github.com'
      );
      expect(res).toMatchSnapshot();
    });
    it('returns renovate internal', async () => {
      hostRules.find.mockReturnValueOnce({ token: 'abc' });
      got.mockImplementationOnce(() => ({
        body: { from: 'www' },
      }));
      const res = await github.fetchJSONFile(
        'renovatebot/presets',
        'presets.json',
        'https://api.github.com/'
      );
      expect(res).toMatchSnapshot();
    });
    it('throws platform error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      await expect(
        github.fetchJSONFile(
          'renovatebot/presets',
          'presets.json',
          'https://api.github.com/'
        )
      ).rejects.toThrow(PLATFORM_FAILURE);
    });
  });
  describe('getPreset()', () => {
    it('passes up platform-failure', async () => {
      got.mockImplementationOnce(() => {
        throw new Error(PLATFORM_FAILURE);
      });
      await expect(github.getPreset('some/repo')).rejects.toThrow(
        PLATFORM_FAILURE
      );
    });
    it('tries default then renovate', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      await expect(github.getPreset('some/repo')).rejects.toThrow();
    });
    it('throws if no content', async () => {
      got.mockImplementationOnce(() => ({
        body: {},
      }));
      await expect(github.getPreset('some/repo')).rejects.toThrow();
    });
    it('throws if fails to parse', async () => {
      got.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('not json').toString('base64'),
        },
      }));
      await expect(github.getPreset('some/repo')).rejects.toThrow();
    });
    it('should return default.json', async () => {
      hostRules.find.mockReturnValueOnce({ token: 'abc' });
      got.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('{"foo":"bar"}').toString('base64'),
        },
      }));
      const content = await github.getPreset('some/repo');
      expect(content).toEqual({ foo: 'bar' });
    });
    it('should query preset within the file', async () => {
      hostRules.find.mockReturnValueOnce({ token: 'abc' });
      got.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('{"somename":{"foo":"bar"}}').toString('base64'),
        },
      }));
      const content = await github.getPreset('some/repo', 'somefile/somename');
      expect(content).toEqual({ foo: 'bar' });
    });
    it('should query subpreset', async () => {
      hostRules.find.mockReturnValueOnce({ token: 'abc' });
      got.mockImplementation(() => ({
        body: {
          content: Buffer.from(
            '{"somename":{"somesubname":{"foo":"bar"}}}'
          ).toString('base64'),
        },
      }));
      let content = await github.getPreset(
        'some/repo',
        'somefile/somename/somesubname'
      );
      expect(content).toEqual({ foo: 'bar' });
      content = await github.getPreset(
        'some/repo',
        'somefile/wrongname/somesubname'
      );
      expect(content).toBeUndefined();
    });
    it('should return custom.json', async () => {
      hostRules.find.mockReturnValueOnce({ token: 'abc' });
      got.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('{"foo":"bar"}').toString('base64'),
        },
      }));
      try {
        global.appMode = true;
        const content = await github.getPreset('some/repo', 'custom');
        expect(content).toEqual({ foo: 'bar' });
      } finally {
        delete global.appMode;
      }
    });
  });
  describe('getPresetFromEndpoint()', () => {
    it('uses custom endpoint', async () => {
      await github
        .getPresetFromEndpoint(
          'some/repo',
          'default',
          'https://api.github.example.org'
        )
        .catch((_) => {});
      expect(got.mock.calls[0][0]).toEqual(
        'https://api.github.example.org/repos/some/repo/contents/default.json'
      );
    });
  });
});
