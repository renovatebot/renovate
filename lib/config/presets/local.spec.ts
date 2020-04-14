import * as gitlab from './gitlab';
import * as github from './github';
import * as local from './local';

jest.mock('./gitlab');
jest.mock('./github');

const gitlabGetPreset: jest.Mock<Promise<any>> = gitlab.getPreset as never;
const githubGetPreset: jest.Mock<Promise<any>> = github.getPreset as never;

describe('config/presets/local', () => {
  beforeEach(() => {
    gitlabGetPreset.mockReset();
    gitlabGetPreset.mockResolvedValueOnce({ resolved: 'preset' });
    githubGetPreset.mockReset();
    githubGetPreset.mockResolvedValueOnce({ resolved: 'preset' });
    global.repoCache = {};
    return global.renovateCache.rmAll();
  });
  describe('getPreset()', () => {
    it('throws for unsupported platform', async () => {
      await expect(
        local.getPreset('some/repo', 'default', {
          platform: 'unsupported-platform',
        })
      ).rejects.toThrow();
    });
    it('forwards to gitlab', async () => {
      const content = await local.getPreset('some/repo', '', {
        platform: 'GitLab',
      });
      expect(gitlabGetPreset.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });
    it('forwards to custom gitlab', async () => {
      const content = await local.getPreset('some/repo', '', {
        platform: 'gitlab',
        endpoint: 'https://gitlab.example.com/api/v4',
      });
      expect(gitlabGetPreset.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });

    it('forwards to github', async () => {
      const content = await local.getPreset('some/repo', undefined, {
        platform: 'github',
      });
      expect(githubGetPreset.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });
    it('forwards to custom github', async () => {
      const content = await local.getPreset('some/repo', '', {
        platform: 'GitHub',
        endpoint: 'https://api.github.example.com',
      });
      expect(githubGetPreset.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });
  });
});
