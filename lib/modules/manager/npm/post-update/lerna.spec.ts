import { envMock, mockExecAll } from '../../../../../test/exec-util';
import { env, mockedFunction, partial } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { RepoGlobalConfig } from '../../../../config/types';
import type { PackageFile, PostUpdateConfig } from '../../types';
import * as lernaHelper from './lerna';
import { getNodeToolConstraint } from './node-version';

jest.mock('../../../../util/exec/env');
jest.mock('./node-version');
jest.mock('../../../datasource');

process.env.BUILDPACK = 'true';

function lernaPkgFile(lernaClient: string): Partial<PackageFile> {
  return {
    lernaClient,
    deps: [{ depName: 'lerna', currentValue: '2.0.0' }],
  };
}

function lernaPkgFileWithoutLernaDep(
  lernaClient: string
): Partial<PackageFile> {
  return {
    lernaClient,
  };
}

const config = partial<PostUpdateConfig>({});

describe('modules/manager/npm/post-update/lerna', () => {
  const globalConfig: RepoGlobalConfig = {
    localDir: '',
    cacheDir: '/tmp/cache',
  };

  describe('generateLockFiles()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.resetModules();
      env.getChildProcessEnv.mockReturnValue(envMock.basic);
      GlobalConfig.set(globalConfig);
      mockedFunction(getNodeToolConstraint).mockResolvedValueOnce({
        toolName: 'node',
        constraint: '16.16.0',
      });
    });

    it('returns if no lernaClient', async () => {
      const res = await lernaHelper.generateLockFiles(
        {},
        'some-dir',
        config,
        {}
      );
      expect(res.error).toBeFalse();
    });

    it('returns if invalid lernaClient', async () => {
      const res = await lernaHelper.generateLockFiles(
        lernaPkgFile('foo'),
        'some-dir',
        config,
        {}
      );
      expect(res.error).toBeFalse();
    });

    it('generates package-lock.json files', async () => {
      const execSnapshots = mockExecAll();
      const skipInstalls = true;
      const res = await lernaHelper.generateLockFiles(
        lernaPkgFile('npm'),
        'some-dir',
        config,
        {},
        skipInstalls
      );
      expect(res.error).toBeFalse();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('performs full npm install', async () => {
      const execSnapshots = mockExecAll();
      const skipInstalls = false;
      const res = await lernaHelper.generateLockFiles(
        lernaPkgFile('npm'),
        'some-dir',
        config,
        {},
        skipInstalls
      );
      expect(res.error).toBeFalse();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('generates yarn.lock files', async () => {
      const execSnapshots = mockExecAll();
      const res = await lernaHelper.generateLockFiles(
        lernaPkgFile('yarn'),
        'some-dir',
        { ...config, constraints: { yarn: '^1.10.0' } },
        {}
      );
      expect(execSnapshots).toMatchSnapshot();
      expect(res.error).toBeFalse();
    });

    it('defaults to latest if lerna version unspecified', async () => {
      const execSnapshots = mockExecAll();
      const res = await lernaHelper.generateLockFiles(
        lernaPkgFileWithoutLernaDep('npm'),
        'some-dir',
        config,
        {}
      );
      expect(res.error).toBeFalse();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('allows scripts for trust level high', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({ ...globalConfig, allowScripts: true });
      const res = await lernaHelper.generateLockFiles(
        lernaPkgFile('npm'),
        'some-dir',
        { ...config, constraints: { npm: '^6.0.0' } },
        {}
      );
      expect(res.error).toBeFalse();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('suppports docker', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({ ...globalConfig, binarySource: 'docker' });

      const res = await lernaHelper.generateLockFiles(
        lernaPkgFile('npm'),
        'some-dir',
        { ...config, constraints: { npm: '6.0.0' } },
        {}
      );
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'docker pull renovate/sidecar',
        },
        {
          cmd: 'docker ps --filter name=renovate_sidecar -aq',
        },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/cache":"/tmp/cache" ' +
            '-e BUILDPACK_CACHE_DIR ' +
            '-w "some-dir" renovate/sidecar ' +
            'bash -l -c "' +
            'install-tool node 16.16.0 ' +
            '&& ' +
            'install-tool npm 6.0.0 ' +
            '&& ' +
            'hash -d npm 2>/dev/null || true ' +
            '&& ' +
            'install-tool lerna 2.0.0 ' +
            '&& ' +
            'lerna info || echo \\"Ignoring lerna info failure\\" ' +
            '&& ' +
            'npm install --ignore-scripts  --no-audit --package-lock-only ' +
            '&& ' +
            'lerna bootstrap --no-ci --ignore-scripts -- --ignore-scripts  --no-audit --package-lock-only' +
            '"',
          options: {
            cwd: 'some-dir',
          },
        },
      ]);
      expect(res.error).toBeFalse();
    });

    it('suppports binarySource=install', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({ ...globalConfig, binarySource: 'install' });

      const res = await lernaHelper.generateLockFiles(
        lernaPkgFile('npm'),
        'some-dir',
        { ...config, constraints: { npm: '6.0.0' } },
        {}
      );
      expect(res.error).toBeFalse();
      expect(execSnapshots).toMatchObject([
        { cmd: 'install-tool node 16.16.0' },
        { cmd: 'install-tool npm 6.0.0' },
        { cmd: 'hash -d npm 2>/dev/null || true' },
        { cmd: 'install-tool lerna 2.0.0' },
        {
          cmd: 'lerna info || echo "Ignoring lerna info failure"',
          options: {
            cwd: 'some-dir',
          },
        },
        {
          cmd: 'npm install --ignore-scripts  --no-audit --package-lock-only',
          options: {
            cwd: 'some-dir',
          },
        },
        {
          cmd: 'lerna bootstrap --no-ci --ignore-scripts -- --ignore-scripts  --no-audit --package-lock-only',
          options: {
            cwd: 'some-dir',
          },
        },
      ]);
    });
  });

  describe('getLernaVersion()', () => {
    it('returns specified version', () => {
      const pkg = {
        deps: [{ depName: 'lerna', currentValue: '2.0.0' }],
      };
      expect(lernaHelper.getLernaVersion(pkg)).toBe('2.0.0');
    });

    it('returns specified range', () => {
      const pkg = {
        deps: [
          { depName: 'lerna', currentValue: '1.x || >=2.5.0 || 5.0.0 - 7.2.3' },
        ],
      };
      expect(lernaHelper.getLernaVersion(pkg)).toBe(
        '1.x || >=2.5.0 || 5.0.0 - 7.2.3'
      );
    });

    it('returns latest if no lerna dep is specified', () => {
      const pkg = {
        deps: [{ depName: 'something-else', currentValue: '1.2.3' }],
      };
      expect(lernaHelper.getLernaVersion(pkg)).toBeNull();
    });

    it('returns latest if pkg has no deps at all', () => {
      const pkg = {};
      expect(lernaHelper.getLernaVersion(pkg)).toBeNull();
    });

    it('returns latest if specified lerna version is not a valid semVer range', () => {
      const pkg = {
        deps: [{ depName: 'lerna', currentValue: '[a.b.c;' }],
      };
      expect(lernaHelper.getLernaVersion(pkg)).toBeNull();
    });
  });
});
