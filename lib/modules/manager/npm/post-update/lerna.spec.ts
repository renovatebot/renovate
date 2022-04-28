import { envMock, exec, mockExecAll } from '../../../../../test/exec-util';
import { env, partial } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { RepoGlobalConfig } from '../../../../config/types';
import type { PackageFile, PostUpdateConfig } from '../../types';
import * as lernaHelper from './lerna';

jest.mock('child_process');
jest.mock('../../../../util/exec/env');
jest.mock('../../npm/post-update/node-version');

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
  const globalConfig: RepoGlobalConfig = { localDir: '' };

  describe('generateLockFiles()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.resetModules();
      env.getChildProcessEnv.mockReturnValue(envMock.basic);
      GlobalConfig.set(globalConfig);
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
      const execSnapshots = mockExecAll(exec);
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
      const execSnapshots = mockExecAll(exec);
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
      const execSnapshots = mockExecAll(exec);
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
      const execSnapshots = mockExecAll(exec);
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
      const execSnapshots = mockExecAll(exec);
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
      expect(lernaHelper.getLernaVersion(pkg)).toBe('latest');
    });

    it('returns latest if pkg has no deps at all', () => {
      const pkg = {};
      expect(lernaHelper.getLernaVersion(pkg)).toBe('latest');
    });

    it('returns latest if specified lerna version is not a valid semVer range', () => {
      const pkg = {
        deps: [{ depName: 'lerna', currentValue: '[a.b.c;' }],
      };
      expect(lernaHelper.getLernaVersion(pkg)).toBe('latest');
    });
  });
});
