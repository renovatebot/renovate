import { mocked, platform } from '../../../../test/util';
import { GlobalConfig } from '../../global';
import * as _gitea from '../gitea';
import * as _github from '../github';
import * as _gitlab from '../gitlab';
import * as local from '.';

jest.mock('../gitea');
jest.mock('../github');
jest.mock('../gitlab');

const gitea = mocked(_gitea);
const github = mocked(_github);
const gitlab = mocked(_gitlab);

describe('config/presets/local/index', () => {
  beforeEach(() => {
    const preset = { resolved: 'preset' };
    platform.getRawFile.mockResolvedValue('{ resolved: "preset" }');
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
        endpoint: 'https://dev.azure.com/renovate12345',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
        presetName: 'default',
      });

      expect(platform.getRawFile).toHaveBeenCalledOnce();
      expect(platform.getRawFile).toHaveBeenCalledWith(
        'default.json',
        'some/repo',
        undefined,
      );
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to bitbucket', async () => {
      GlobalConfig.set({
        platform: 'bitbucket',
        endpoint: 'https://api.bitbucket.org',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
        presetName: 'default',
      });

      expect(platform.getRawFile).toHaveBeenCalledOnce();
      expect(platform.getRawFile).toHaveBeenCalledWith(
        'default.json',
        'some/repo',
        undefined,
      );
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

      expect(platform.getRawFile).toHaveBeenCalledOnce();
      expect(platform.getRawFile).toHaveBeenCalledWith(
        'default.json',
        'some/repo',
        undefined,
      );
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to gitea', async () => {
      GlobalConfig.set({
        platform: 'gitea',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
      });

      expect(gitea.getPresetFromEndpoint).toHaveBeenCalledOnce();
      expect(gitea.getPresetFromEndpoint).toHaveBeenCalledWith(
        'some/repo',
        'default',
        undefined,
        undefined,
        undefined,
      );
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
      expect(gitea.getPresetFromEndpoint).toHaveBeenCalledOnce();
      expect(gitea.getPresetFromEndpoint).toHaveBeenCalledWith(
        'some/repo',
        'default',
        undefined,
        'https://api.gitea.example.com',
        undefined,
      );
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to github', async () => {
      GlobalConfig.set({
        platform: 'github',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
      });

      expect(github.getPresetFromEndpoint).toHaveBeenCalledOnce();
      expect(github.getPresetFromEndpoint).toHaveBeenCalledWith(
        'some/repo',
        'default',
        undefined,
        undefined,
        undefined,
      );
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

      expect(github.getPresetFromEndpoint).toHaveBeenCalledOnce();
      expect(github.getPresetFromEndpoint).toHaveBeenCalledWith(
        'some/repo',
        'default',
        undefined,
        'https://api.github.example.com',
        undefined,
      );
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

      expect(github.getPresetFromEndpoint).toHaveBeenCalledOnce();
      expect(github.getPresetFromEndpoint).toHaveBeenCalledWith(
        'some/repo',
        'default',
        undefined,
        undefined,
        'someTag',
      );
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

      expect(github.getPresetFromEndpoint).toHaveBeenCalledOnce();
      expect(github.getPresetFromEndpoint).toHaveBeenCalledWith(
        'some/repo',
        'default',
        undefined,
        'https://api.github.example.com',
        'someTag',
      );
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to gitlab', async () => {
      GlobalConfig.set({
        platform: 'gitlab',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
        presetName: 'default',
      });

      expect(gitlab.getPresetFromEndpoint).toHaveBeenCalledOnce();
      expect(gitlab.getPresetFromEndpoint).toHaveBeenCalledWith(
        'some/repo',
        'default',
        undefined,
        undefined,
        undefined,
      );
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

      expect(gitlab.getPresetFromEndpoint).toHaveBeenCalledOnce();
      expect(gitlab.getPresetFromEndpoint).toHaveBeenCalledWith(
        'some/repo',
        'default',
        undefined,
        'https://gitlab.example.com/api/v4',
        undefined,
      );
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to gitlab with a tag', async () => {
      GlobalConfig.set({ platform: 'gitlab' });
      const content = await local.getPreset({
        repo: 'some/repo',
        presetName: 'default',
        tag: 'someTag',
      });

      expect(gitlab.getPresetFromEndpoint).toHaveBeenCalledOnce();
      expect(gitlab.getPresetFromEndpoint).toHaveBeenCalledWith(
        'some/repo',
        'default',
        undefined,
        undefined,
        'someTag',
      );
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

      expect(gitlab.getPresetFromEndpoint).toHaveBeenCalledOnce();
      expect(gitlab.getPresetFromEndpoint).toHaveBeenCalledWith(
        'some/repo',
        'default',
        undefined,
        'https://gitlab.example.com/api/v4',
        'someTag',
      );
      expect(content).toEqual({ resolved: 'preset' });
    });
  });
});
