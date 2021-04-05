import { exec as _exec } from 'child_process';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { getName, mocked } from '../../../../test/util';
import { setAdminConfig } from '../../../config/admin';
import * as _env from '../../../util/exec/env';
import * as _lernaHelper from './lerna';

jest.mock('child_process');
jest.mock('../../../util/exec/env');
jest.mock('../../../manager/npm/post-update/node-version');

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const lernaHelper = mocked(_lernaHelper);

function lernaPkgFile(lernaClient: string) {
  return {
    lernaClient,
    deps: [{ depName: 'lerna', currentValue: '2.0.0' }],
  };
}

function lernaPkgFileWithoutLernaDep(lernaClient: string) {
  return {
    lernaClient,
  };
}
describe(getName(__filename), () => {
  describe('generateLockFiles()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.resetModules();
      env.getChildProcessEnv.mockReturnValue(envMock.basic);
    });
    it('returns if no lernaClient', async () => {
      const res = await lernaHelper.generateLockFiles({}, 'some-dir', {}, {});
      expect(res.error).toBe(false);
    });
    it('returns if invalid lernaClient', async () => {
      const res = await lernaHelper.generateLockFiles(
        lernaPkgFile('foo'),
        'some-dir',
        {},
        {}
      );
      expect(res.error).toBe(false);
    });
    it('generates package-lock.json files', async () => {
      const execSnapshots = mockExecAll(exec);
      const skipInstalls = true;
      const res = await lernaHelper.generateLockFiles(
        lernaPkgFile('npm'),
        'some-dir',
        {},
        {},
        skipInstalls
      );
      expect(res.error).toBe(false);
      expect(execSnapshots).toMatchSnapshot();
    });
    it('performs full npm install', async () => {
      const execSnapshots = mockExecAll(exec);
      const skipInstalls = false;
      const res = await lernaHelper.generateLockFiles(
        lernaPkgFile('npm'),
        'some-dir',
        {},
        {},
        skipInstalls
      );
      expect(res.error).toBe(false);
      expect(execSnapshots).toMatchSnapshot();
    });
    it('generates yarn.lock files', async () => {
      const execSnapshots = mockExecAll(exec);
      const res = await lernaHelper.generateLockFiles(
        lernaPkgFile('yarn'),
        'some-dir',
        { constraints: { yarn: '^1.10.0' } },
        {}
      );
      expect(execSnapshots).toMatchSnapshot();
      expect(res.error).toBe(false);
    });
    it('defaults to latest if lerna version unspecified', async () => {
      const execSnapshots = mockExecAll(exec);
      const res = await lernaHelper.generateLockFiles(
        lernaPkgFileWithoutLernaDep('npm'),
        'some-dir',
        {},
        {}
      );
      expect(res.error).toBe(false);
      expect(execSnapshots).toMatchSnapshot();
    });
    it('allows scripts for trust level high', async () => {
      const execSnapshots = mockExecAll(exec);
      setAdminConfig({ allowScripts: true });
      const res = await lernaHelper.generateLockFiles(
        lernaPkgFile('npm'),
        'some-dir',
        { constraints: { npm: '^6.0.0' } },
        {}
      );
      expect(res.error).toBe(false);
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
