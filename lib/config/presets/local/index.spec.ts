import { GlobalConfig } from '../../global.ts';
import * as _forgejo from '../forgejo/index.ts';
import * as _gitea from '../gitea/index.ts';
import * as _github from '../github/index.ts';
import * as _gitlab from '../gitlab/index.ts';
import * as local from './index.ts';
import { platform } from '~test/util.ts';

vi.mock('../forgejo/index.ts');
vi.mock('../gitea/index.ts');
vi.mock('../github/index.ts');
vi.mock('../gitlab/index.ts');

const forgejo = vi.mocked(_forgejo);
const gitea = vi.mocked(_gitea);
const github = vi.mocked(_github);
const gitlab = vi.mocked(_gitlab);

describe('config/presets/local/index', () => {
  beforeEach(() => {
    const preset = { resolved: 'preset' };
    platform.getRawFile.mockResolvedValue('{ resolved: "preset" }');
    gitea.getPresetFromEndpoint.mockResolvedValueOnce(preset);
    forgejo.getPresetFromEndpoint.mockResolvedValueOnce(preset);
    github.getPresetFromEndpoint.mockResolvedValueOnce(preset);
    gitlab.getPresetFromEndpoint.mockResolvedValueOnce(preset);
  });

  describe('getPreset()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
    });

    it('throws for unsupported platform', async () => {
      GlobalConfig.set({
        // @ts-expect-error -- testing invalid platform
        platform: 'unsupported-platform',
      });
      // eslint-disable-next-line vitest/no-unneeded-async-expect-function -- local isn't async
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
      // eslint-disable-next-line vitest/no-unneeded-async-expect-function -- local isn't async
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

      expect(platform.getRawFile).toHaveBeenCalledExactlyOnceWith(
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

      expect(platform.getRawFile).toHaveBeenCalledExactlyOnceWith(
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

      expect(platform.getRawFile).toHaveBeenCalledExactlyOnceWith(
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

      expect(gitea.getPresetFromEndpoint).toHaveBeenCalledExactlyOnceWith(
        'some/repo',
        'default',
        undefined,
        undefined,
        undefined,
      );
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to forgejo', async () => {
      GlobalConfig.set({
        platform: 'forgejo',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
      });

      expect(forgejo.getPresetFromEndpoint).toHaveBeenCalledExactlyOnceWith(
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
      expect(gitea.getPresetFromEndpoint).toHaveBeenCalledExactlyOnceWith(
        'some/repo',
        'default',
        undefined,
        'https://api.gitea.example.com',
        undefined,
      );
      expect(content).toEqual({ resolved: 'preset' });
    });

    it('forwards to custom forgejo', async () => {
      GlobalConfig.set({
        platform: 'forgejo',
        endpoint: 'https://api.forgejo.example.com',
      });
      const content = await local.getPreset({
        repo: 'some/repo',
        presetName: 'default',
      });
      expect(forgejo.getPresetFromEndpoint).toHaveBeenCalledExactlyOnceWith(
        'some/repo',
        'default',
        undefined,
        'https://api.forgejo.example.com',
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

      expect(github.getPresetFromEndpoint).toHaveBeenCalledExactlyOnceWith(
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

      expect(github.getPresetFromEndpoint).toHaveBeenCalledExactlyOnceWith(
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

      expect(github.getPresetFromEndpoint).toHaveBeenCalledExactlyOnceWith(
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

      expect(github.getPresetFromEndpoint).toHaveBeenCalledExactlyOnceWith(
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

      expect(gitlab.getPresetFromEndpoint).toHaveBeenCalledExactlyOnceWith(
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

      expect(gitlab.getPresetFromEndpoint).toHaveBeenCalledExactlyOnceWith(
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

      expect(gitlab.getPresetFromEndpoint).toHaveBeenCalledExactlyOnceWith(
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

      expect(gitlab.getPresetFromEndpoint).toHaveBeenCalledExactlyOnceWith(
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
