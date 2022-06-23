import { mocked } from '../../../../test/util';
import { GlobalConfig } from '../../global';
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

describe('config/presets/local/index', () => {
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
    beforeEach(() => {
      GlobalConfig.reset();
    });

    it('throws for unsupported platform', async () => {
      GlobalConfig.set({
        platform: 'unsupported-platform',
      });
      await expect(async () => {
        await local.getPreset({
          repo: 'some/repo',
          presetName: 'default',
        });
      }).rejects.toThrow();
    });

    it('throws for missing platform', async () => {
      GlobalConfig.set({
        platform: undefined,
      });
      await expect(async () => {
        await local.getPreset({
          repo: 'some/repo',
          presetName: 'default',
        });
      }).rejects.toThrow();
    });

    it('forwards to azure', async () => {
      GlobalConfig.set({
        platform: 'azure',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
        presetName: 'default',
      });
      expect(azure.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to bitbucket', async () => {
      GlobalConfig.set({
        platform: 'bitbucket',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
        presetName: 'default',
      });
      expect(bitbucket.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to custom bitbucket-server', async () => {
      GlobalConfig.set({
        platform: 'bitbucket-server',
        endpoint: 'https://git.example.com',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
        presetName: 'default',
      });
      expect(
        bitbucketServer.getPresetFromEndpoint.mock.calls
      ).toMatchSnapshot();
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to gitea', async () => {
      GlobalConfig.set({
        platform: 'gitea',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
      });
      expect(gitea.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to custom gitea', async () => {
      GlobalConfig.set({
        platform: 'gitea',
        endpoint: 'https://api.gitea.example.com',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
        presetName: 'default',
      });
      expect(gitea.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to github', async () => {
      GlobalConfig.set({
        platform: 'github',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
      });
      expect(github.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to custom github', async () => {
      GlobalConfig.set({
        platform: 'github',
        endpoint: 'https://api.github.example.com',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
        presetName: 'default',
      });
      expect(github.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to github with a tag', async () => {
      GlobalConfig.set({
        platform: 'github',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
        tag: 'someTag',
      });
      expect(github.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to custom github with a tag', async () => {
      GlobalConfig.set({
        platform: 'github',
        endpoint: 'https://api.github.example.com',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
        presetName: 'default',
        tag: 'someTag',
      });
      expect(github.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to gitlab', async () => {
      GlobalConfig.set({
        platform: 'GitLab',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
        presetName: 'default',
      });
      expect(gitlab.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to custom gitlab', async () => {
      GlobalConfig.set({
        platform: 'gitlab',
        endpoint: 'https://gitlab.example.com/api/v4',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
        presetName: 'default',
      });
      expect(gitlab.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to gitlab with a tag', async () => {
      GlobalConfig.set({ platform: 'GitLab' });
      const content = await local.getPreset({
        repo: 'some/repo',
        presetName: 'default',
        tag: 'someTag',
      });
      expect(gitlab.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to custom gitlab with a tag', async () => {
      GlobalConfig.set({
        platform: 'gitlab',
        endpoint: 'https://gitlab.example.com/api/v4',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
        presetName: 'default',
        tag: 'someTag',
      });
      expect(gitlab.getPresetFromEndpoint.mock.calls).toMatchSnapshot();
      expect(content).toEqual({ resolved: 'preset' });
    });
  });
});
