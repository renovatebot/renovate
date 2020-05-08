import { mocked } from '../../../test/util';
import { PLATFORM_FAILURE } from '../../constants/error-messages';
import { GotResponse } from '../../platform';
import _got from '../../util/got';
import * as _hostRules from '../../util/host-rules';
import * as github from './github';
import { PartialDeep } from 'type-fest';

jest.mock('../../util/got');
jest.mock('../../util/host-rules');

const got: jest.Mock<PartialDeep<GotResponse>> = _got as never;
const hostRules = mocked(_hostRules);

describe('config/presets/github', () => {
  beforeEach(() => {
    got.mockReset();
    return global.renovateCache.rmAll();
  });

  describe('getPreset()', () => {
    it('passes up platform-failure', async () => {
      got.mockImplementationOnce(() => {
        throw new Error(PLATFORM_FAILURE);
      });
      await expect(
        github.getPreset({ packageName: 'some/repo' })
      ).rejects.toThrow(PLATFORM_FAILURE);
    });
    it('tries default then renovate', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      await expect(
        github.getPreset({ packageName: 'some/repo' })
      ).rejects.toThrow();
    });
    it('throws if no content', async () => {
      got.mockImplementationOnce(() => ({
        body: {},
      }));
      await expect(
        github.getPreset({ packageName: 'some/repo' })
      ).rejects.toThrow();
    });
    it('throws if fails to parse', async () => {
      got.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('not json').toString('base64'),
        },
      }));
      await expect(
        github.getPreset({ packageName: 'some/repo' })
      ).rejects.toThrow();
    });
    it('should return default.json', async () => {
      hostRules.find.mockReturnValueOnce({ token: 'abc' });
      got.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('{"foo":"bar"}').toString('base64'),
        },
      }));
      const content = await github.getPreset({ packageName: 'some/repo' });
      expect(content).toEqual({ foo: 'bar' });
    });
    it('should query preset within the file', async () => {
      hostRules.find.mockReturnValueOnce({ token: 'abc' });
      got.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('{"somename":{"foo":"bar"}}').toString('base64'),
        },
      }));
      const content = await github.getPreset({
        packageName: 'some/repo',
        presetName: 'somefile/somename',
      });
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
      let content = await github.getPreset({
        packageName: 'some/repo',
        presetName: 'somefile/somename/somesubname',
      });
      expect(content).toEqual({ foo: 'bar' });
      content = await github.getPreset({
        packageName: 'some/repo',
        presetName: 'somefile/wrongname/somesubname',
      });
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
        const content = await github.getPreset({
          packageName: 'some/repo',
          presetName: 'custom',
        });
        expect(content).toEqual({ foo: 'bar' });
      } finally {
        delete global.appMode;
      }
    });
  });
});
