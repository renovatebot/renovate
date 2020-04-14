import * as github from './github';
import _got from '../../util/got';
import * as _hostRules from '../../util/host-rules';
import { PLATFORM_FAILURE } from '../../constants/error-messages';

jest.mock('../../platform/github/gh-got-wrapper');
jest.mock('../../util/got');
jest.mock('../../util/host-rules');

const got: any = _got;
const hostRules: any = _hostRules;

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

    it('uses default endpoint', async () => {
      await github.getPreset('some/repo', 'default').catch((_) => {});
      expect(got.mock.calls[0][0]).toEqual(
        'https://api.github.com/repos/some/repo/contents/default.json'
      );
    });
    it('uses custom endpoint', async () => {
      await github
        .getPreset('some/repo', 'default', {
          endpoint: 'https://api.github.example.org',
        })
        .catch((_) => {});
      expect(got.mock.calls[0][0]).toEqual(
        'https://api.github.example.org/repos/some/repo/contents/default.json'
      );
    });
  });
});
