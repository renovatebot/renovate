import { getName, mocked } from '../../../../test/util';
import * as _azure from '../azure';
import * as _bitbucket from '../bitbucket';
import * as _bitbucketServer from '../bitbucket-server';
import * as _gitea from '../gitea';
import * as _github from '../github';
import * as _gitlab from '../gitlab';
import * as local from '.';

jest.mock('../azure');
jest.mock('../bitbucket');
jest.mock('../bitbucket-server');
jest.mock('../gitea');
jest.mock('../github');
jest.mock('../gitlab');

const azure = mocked(_azure);
const bitbucket = mocked(_bitbucket);
const bitbucketServer = mocked(_bitbucketServer);
const gitea = mocked(_gitea);
const github = mocked(_github);
const gitlab = mocked(_gitlab);

describe(getName(__filename), () => {
  beforeEach(() => {
    jest.resetAllMocks();
    const preset = { resolved: 'preset' };
    azure.getPresetFromEndpoint.mockResolvedValueOnce(preset);
    bitbucket.getPresetFromEndpoint.mockResolvedValueOnce(preset);
    bitbucketServer.getPresetFromEndpoint.mockResolvedValueOnce(preset);
    gitea.getPresetFromEndpoint.mockResolvedValueOnce(preset);
    github.getPresetFromEndpoint.mockResolvedValueOnce(preset);
    gitlab.getPresetFromEndpoint.mockResolvedValueOnce(preset);
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

    it('forwards to azure', async () => {
      const content = await local.getPreset({
        packageName: 'some/repo',
        presetName: 'default',
        baseConfig: {
          platform: 'azure',
        },
      });
      expect(azure.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });

    it('forwards to bitbucket', async () => {
      const content = await local.getPreset({
        packageName: 'some/repo',
        presetName: 'default',
        baseConfig: {
          platform: 'bitbucket',
        },
      });
      expect(bitbucket.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
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

    it('forwards to gitea', async () => {
      const content = await local.getPreset({
        packageName: 'some/repo',
        baseConfig: {
          platform: 'gitea',
        },
      });
      expect(gitea.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });
    it('forwards to custom gitea', async () => {
      const content = await local.getPreset({
        packageName: 'some/repo',
        presetName: 'default',
        baseConfig: {
          platform: 'gitea',
          endpoint: 'https://api.gitea.example.com',
        },
      });
      expect(gitea.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
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
  });
});
