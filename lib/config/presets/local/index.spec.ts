import { getName, mocked } from '../../../../test/util';
import * as _bitbucketServer from '../bitbucket-server';
import * as _github from '../github';
import * as _gitlab from '../gitlab';
import * as local from '.';

jest.mock('../gitlab');
jest.mock('../github');
jest.mock('../bitbucket-server');

const gitlab = mocked(_gitlab);
const github = mocked(_github);
const bitbucketServer = mocked(_bitbucketServer);

describe(getName(__filename), () => {
  beforeEach(() => {
    jest.resetAllMocks();
    gitlab.getPresetFromEndpoint.mockResolvedValueOnce({ resolved: 'preset' });
    github.getPresetFromEndpoint.mockResolvedValueOnce({ resolved: 'preset' });
  });
  describe('getPreset()', () => {
    it('throws for unsupported platform', async () => {
      await expect(async () => {
        await local.getPreset({
          packageName: 'some/repo',
          presetName: 'default',
          baseConfig: {
            platform: 'unsupported-platform',
          },
        });
      }).rejects.toThrow();
    });
    it('throws for missing platform', async () => {
      await expect(async () => {
        await local.getPreset({
          packageName: 'some/repo',
          presetName: 'default',
          baseConfig: {
            platform: undefined,
          },
        });
      }).rejects.toThrow();
    });
    it('forwards to gitlab', async () => {
      const content = await local.getPreset({
        packageName: 'some/repo',
        presetName: 'default',
        baseConfig: {
          platform: 'GitLab',
        },
      });
      expect(gitlab.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
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
      expect(gitlab.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });

    it('forwards to github', async () => {
      const content = await local.getPreset({
        packageName: 'some/repo',
        baseConfig: {
          platform: 'github',
        },
      });
      expect(github.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
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
      expect(github.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });

    it('forwards to custom bitbucket-server', async () => {
      const content = await local.getPreset({
        packageName: 'some/repo',
        presetName: 'default',
        baseConfig: {
          platform: 'bitbucket-server',
          endpoint: 'https://git.example.com',
        },
      });
      expect(
        bitbucketServer.getPresetFromEndpoint.mock.calls
      ).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });
  });
});
