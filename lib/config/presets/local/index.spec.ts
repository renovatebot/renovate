import { getName, mocked } from '../../../../test/util';
import * as globalCache from '../../../util/cache/global';
import * as _github from '../github';
import * as _gitlab from '../gitlab';
import * as local from '.';

jest.mock('../gitlab');
jest.mock('../github');

const gitlab = mocked(_gitlab);
const github = mocked(_github);

describe(getName(__filename), () => {
  beforeEach(() => {
    jest.resetAllMocks();
    gitlab.getPresetFromEndpoint.mockResolvedValueOnce({ resolved: 'preset' });
    github.getPresetFromEndpoint.mockResolvedValueOnce({ resolved: 'preset' });
    return globalCache.rmAll();
  });
  describe('getPreset()', () => {
    it('throws for unsupported platform', async () => {
      await expect(
        local.getPreset({
          packageName: 'some/repo',
          presetName: 'default',
          baseConfig: {
            platform: 'unsupported-platform',
          },
        })
      ).rejects.toThrow();
    });
    it('throws for missing platform', async () => {
      await expect(
        local.getPreset({
          packageName: 'some/repo',
          presetName: 'default',
          baseConfig: {
            platform: undefined,
          },
        })
      ).rejects.toThrow();
    });
    it('forwards to gitlab', async () => {
      const content = await local.getPreset({
        packageName: 'some/repo',
        presetName: 'default',
        baseConfig: {
          platform: 'GitLab',
        },
      });
      expect(gitlab.fetchJSONFile.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });
    it('forwards to custom gitlab', async () => {
      const content = await local.getPreset({
        packageName: 'some/repo',
        presetName: 'default',
        baseConfig: {
          platform: 'gitlab',
          endpoint: 'https://gitlab.example.com/api/v4',
        },
      });
      expect(gitlab.fetchJSONFile.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });

    it('forwards to github', async () => {
      const content = await local.getPreset({
        packageName: 'some/repo',
        baseConfig: {
          platform: 'github',
        },
      });
      expect(github.fetchJSONFile.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });
    it('forwards to custom github', async () => {
      const content = await local.getPreset({
        packageName: 'some/repo',
        presetName: 'default',
        baseConfig: {
          platform: 'github',
          endpoint: 'https://api.github.example.com',
        },
      });
      expect(github.fetchJSONFile.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });
  });
});
