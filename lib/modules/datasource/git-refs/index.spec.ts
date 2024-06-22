import { SimpleGit, simpleGit } from 'simple-git';
import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import { add, clear } from '../../../util/host-rules';
import { GitRefsDatasource } from '.';

jest.mock('simple-git');
const simpleGitFactoryMock = simpleGit as jest.Mock<Partial<SimpleGit>>;

const packageName = 'https://github.com/example/example.git';

const lsRemote1 = Fixtures.get('ls-remote-1.txt');

const datasource = GitRefsDatasource.id;

describe('modules/datasource/git-refs/index', () => {
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

      const versions = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(versions).toBeNull();
    });

    it('returns nil if response is malformed', async () => {
      gitMock.listRemote.mockResolvedValue('aabbccddeeff');

      const { releases } = (await getPkgReleases({
        datasource,
        packageName,
      }))!;
      expect(releases).toBeEmpty();
    });

    it('returns nil if remote call throws exception', async () => {
      gitMock.listRemote.mockRejectedValue(new Error());

      const versions = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(versions).toBeNull();
    });

    it('returns versions filtered from tags', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const versions = await getPkgReleases({
        datasource,
        packageName,
      });
      expect(versions).toMatchSnapshot();
      const result = versions?.releases.map((x) => x.version).sort();
      expect(result).toHaveLength(6);
    });
  });

  describe('getDigest()', () => {
    it('returns null if not found', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await new GitRefsDatasource().getDigest(
        { packageName: 'a tag to look up' },
        'v2.0.0',
      );
      expect(digest).toBeNull();
    });

    it('returns digest for tag', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await new GitRefsDatasource().getDigest(
        { packageName: 'a tag to look up' },
        'v1.0.4',
      );
      expect(digest).toBe('2b52829c7c1bd65b3501c450849c53b90b11fa0e');
    });

    it('ignores refs/for/', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await new GitRefsDatasource().getDigest(
        { packageName: 'a tag to look up' },
        'master',
      );
      expect(digest).toBe('a9920c014aebc28dc1b23e7efcc006d0455cc710');
    });

    it('returns digest for HEAD', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await new GitRefsDatasource().getDigest(
        { packageName: 'another tag to look up' },
        undefined,
      );
      expect(digest).toBe('a9920c014aebc28dc1b23e7efcc006d0455cc710');
    });

    it('calls simpleGit with emptyEnv if no hostrules exist', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      const digest = await new GitRefsDatasource().getDigest(
        { packageName: 'another tag to look up' },
        undefined,
      );
      expect(digest).toBe('a9920c014aebc28dc1b23e7efcc006d0455cc710');
      expect(gitMock.env).toHaveBeenCalledWith({});
    });

    it('calls simpleGit with git envs if hostrules exist', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      add({
        hostType: 'github',
        matchHost: 'api.github.com',
        token: 'token123',
      });

      const digest = await new GitRefsDatasource().getDigest(
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

    it('calls simpleGit with git envs if hostrules exist for datasource type git-refs', async () => {
      gitMock.listRemote.mockResolvedValue(lsRemote1);

      add({
        hostType: 'git-refs',
        matchHost: 'git.example.com',
        token: 'token123',
      });

      const digest = await new GitRefsDatasource().getDigest(
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
