import * as github from '../github';
import * as gitlab from '../gitlab';
import * as local from '.';

jest.mock('../gitlab');
jest.mock('../github');

const gitlabGetPreset: jest.Mock<Promise<
  any
>> = gitlab.getPresetFromEndpoint as never;
const githubGetPreset: jest.Mock<Promise<
  any
>> = github.getPresetFromEndpoint as never;

describe('config/presets/local', () => {
  beforeEach(() => {
    gitlabGetPreset.mockReset();
    gitlabGetPreset.mockResolvedValueOnce({ resolved: 'preset' });
    githubGetPreset.mockReset();
    githubGetPreset.mockResolvedValueOnce({ resolved: 'preset' });
    return global.renovateCache.rmAll();
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
        presetName: '',
        baseConfig: {
          platform: 'GitLab',
        },
      });
      expect(gitlabGetPreset.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });
    it('forwards to custom gitlab', async () => {
      const content = await local.getPreset({
        packageName: 'some/repo',
        presetName: '',
        baseConfig: {
          platform: 'gitlab',
          endpoint: 'https://gitlab.example.com/api/v4',
        },
      });
      expect(gitlabGetPreset.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });

    it('forwards to github', async () => {
      const content = await local.getPreset({
        packageName: 'some/repo',
        baseConfig: {
          platform: 'github',
        },
      });
      expect(githubGetPreset.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });
    it('forwards to custom github', async () => {
      const content = await local.getPreset({
        packageName: 'some/repo',
        presetName: '',
        baseConfig: {
          platform: 'github',
          endpoint: 'https://api.github.example.com',
        },
      });
      expect(githubGetPreset.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });
  });
});
