import { SimpleGit, simpleGit } from 'simple-git';
import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import { add, clear } from '../../../util/host-rules';
import { GitTagsDatasource } from '.';

jest.mock('simple-git');
const simpleGitFactoryMock = simpleGit as jest.Mock<Partial<SimpleGit>>;

const packageName = 'https://github.com/example/example.git';

const lsRemote1 = Fixtures.get('ls-remote-1.txt', '../git-refs');

const datasource = GitTagsDatasource.id;
const datasourceInstance = new GitTagsDatasource();

describe('modules/datasource/git-tags/index', () => {
  let gitMock: jest.MockedObject<Pick<SimpleGit, 'env' | 'listRemote'>>;

  beforeEach(() => {
    // clear host rules
    clear();

    // clear environment variables
    process.env = {};

    // reset git mock
    gitMock = {
      env: jest.fn(),
      listRemote: jest.fn(),
    };

    simpleGitFactoryMock.mockReturnValue(gitMock);
    gitMock.env.mockImplementation(() => gitMock as unknown as SimpleGit);
  });

  describe('getReleases', () => {
    it('returns nil if response is wrong', async () => {
      gitMock.listRemote.mockResolvedValue('');

      const versions = await getPkgReleases({ datasource, packageName });
      expect(versions).toBeNull();
    });

    it('returns nil if remote call throws exception', async () => {
      gitMock.listRemote.mockRejectedValue(new Error());

      const versions = await getPkgReleases({ datasource, packageName });
      expect(versions).toBeNull();
    });

    it('returns versions filtered from tags', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const versions = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(versions).toMatchSnapshot();
    });
  });

  describe('getDigest()', () => {
    it('returns null if not found', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await datasourceInstance.getDigest(
        { packageName: 'a tag to look up' },
        'notfound',
      );
      expect(digest).toBeNull();
    });

    it('returns digest for tag', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await datasourceInstance.getDigest(
        { packageName: 'a tag to look up' },
        'v1.0.2',
      );
      expect(digest).toBe('9cb93e0b236385a4e2efd089d7c6a458f5ff321f');
    });

    it('returns digest for HEAD', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await datasourceInstance.getDigest(
        { packageName: 'another tag to look up' },
        undefined,
      );
      expect(digest).toBe('a9920c014aebc28dc1b23e7efcc006d0455cc710');
    });

    it('returns digest for HEAD with authentication environment variables', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      add({
        hostType: 'github',
        matchHost: 'api.github.com',
        token: 'token123',
      });

      const digest = await datasourceInstance.getDigest(
        { packageName: 'another tag to look up' },
        undefined,
      );
      expect(digest).toBe('a9920c014aebc28dc1b23e7efcc006d0455cc710');
      expect(gitMock.env).toHaveBeenCalledWith({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://ssh:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://git:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://token123@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'https://github.com/',
      });
    });

    it('returns digest for HEAD with authentication environment variables for datasource type git-tags', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      add({
        hostType: 'git-tags',
        matchHost: 'git.example.com',
        token: 'token123',
      });

      const digest = await datasourceInstance.getDigest(
        { packageName: 'another tag to look up' },
        undefined,
      );
      expect(digest).toBe('a9920c014aebc28dc1b23e7efcc006d0455cc710');
      expect(gitMock.env).toHaveBeenCalledWith({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://ssh:token123@git.example.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://git:token123@git.example.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://token123@git.example.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@git.example.com/',
        GIT_CONFIG_VALUE_1: 'git@git.example.com:',
        GIT_CONFIG_VALUE_2: 'https://git.example.com/',
      });
    });
  });
});
