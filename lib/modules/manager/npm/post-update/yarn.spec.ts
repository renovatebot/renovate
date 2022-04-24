import { exec as _exec } from 'child_process';
import fs from 'fs-extra';
import {
  ExecSnapshots,
  envMock,
  mockExecAll,
} from '../../../../../test/exec-util';
import { Fixtures } from '../../../../../test/fixtures';
import * as httpMock from '../../../../../test/http-mock';
import { mocked } from '../../../../../test/util';
import * as _env from '../../../../util/exec/env';
import * as yarnHelper from './yarn';

jest.mock('fs-extra', () =>
  require('../../../../../test/fixtures').Fixtures.fsExtra()
);
jest.mock('child_process');
jest.mock('../../../../util/exec/env');
jest.mock('./node-version');

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);

delete process.env.NPM_CONFIG_CACHE;

// TODO: figure out snapshot similarity for each CI platform (#9617)
const fixSnapshots = (snapshots: ExecSnapshots): ExecSnapshots =>
  snapshots.map((snapshot) => ({
    ...snapshot,
    cmd: snapshot.cmd.replace(/^.*\/yarn.*?\.js\s+/, '<yarn> '),
  }));

describe('modules/manager/npm/post-update/yarn', () => {
  beforeEach(() => {
    Fixtures.reset();
    jest.clearAllMocks();
    jest.resetModules();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });

  it.each([
    ['1.22.0', '^1.10.0', null, 2],
    ['2.1.0', '>= 2.0.0', ['2.1.0', '2.0.1'], 1],
    ['2.2.0', '2.2.0', null, 1],
    ['3.0.0', '3.0.0', null, 1],
  ])(
    'generates lock files using yarn v%s',
    async (yarnVersion, yarnCompatibility, yarnReleases, expectedFsCalls) => {
      Fixtures.mock(
        {
          '.yarnrc': 'yarn-path ./.yarn/cli.js\n',
          'yarn.lock': 'package-lock-contents',
        },
        '/some-dir'
      );
      if (yarnReleases) {
        httpMock
          .scope('https://registry.npmjs.org')
          .get('/@yarnpkg%2Fcli')
          .reply(200, {
            releases: [
              yarnReleases.map((v) => {
                return { version: v };
              }),
            ],
          });
      }
      const execSnapshots = mockExecAll(exec, {
        stdout: yarnVersion,
        stderr: '',
      });
      const config = {
        constraints: {
          yarn: yarnCompatibility,
        },
        postUpdateOptions: ['yarnDedupeFewer', 'yarnDedupeHighest'],
      };
      const res = await yarnHelper.generateLockFile(
        '/some-dir',
        {
          YARN_CACHE_FOLDER: '/tmp/renovate/cache/yarn',
          YARN_GLOBAL_FOLDER: '/tmp/renovate/cache/berry',
        },
        config
      );
      expect(fs.readFile).toHaveBeenCalledTimes(expectedFsCalls);
      expect(fs.remove).toHaveBeenCalledTimes(0);
      expect(res.lockFile).toBe('package-lock-contents');
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    }
  );

  it('only skips build if skipInstalls is false', async () => {
    Fixtures.mock(
      {
        'yarn.lock': 'package-lock-contents',
      },
      'some-dir'
    );
    const execSnapshots = mockExecAll(exec, {
      stdout: '3.0.0',
      stderr: '',
    });
    const config = {
      constraints: {
        yarn: '3.0.0',
      },
      postUpdateOptions: ['yarnDedupeFewer', 'yarnDedupeHighest'],
      skipInstalls: false,
    };
    const res = await yarnHelper.generateLockFile('some-dir', {}, config);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
  });

  it('does not use global cache if zero install is detected', async () => {
    Fixtures.mock(
      {
        'yarn.lock': 'package-lock-contents',
      },
      'some-dir'
    );
    httpMock
      .scope('https://registry.npmjs.org')
      .get('/@yarnpkg%2Fcli')
      .reply(200, { releases: [{ version: '2.1.0' }] });
    const execSnapshots = mockExecAll(exec, {
      stdout: '2.1.0',
      stderr: '',
    });
    const config = {
      constraints: {
        yarn: '>= 2.0.0',
      },
      postUpdateOptions: ['yarnDedupeFewer', 'yarnDedupeHighest'],
      managerData: { yarnZeroInstall: true },
    };
    const res = await yarnHelper.generateLockFile('some-dir', {}, config);
    expect(res.lockFile).toBe('package-lock-contents');
    expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
  });

  it.each([
    ['1.22.0', '^1.10.0', null],
    ['2.1.0', '>= 2.0.0', ['2.1.0']],
    ['3.0.0', '3.0.0', null],
  ])(
    'performs lock file updates using yarn v%s',
    async (yarnVersion, yarnCompatibility, yarnReleases) => {
      Fixtures.mock(
        {
          'yarn.lock': 'package-lock-contents',
        },
        'some-dir'
      );
      if (yarnReleases) {
        httpMock
          .scope('https://registry.npmjs.org')
          .get('/@yarnpkg%2Fcli')
          .reply(200, {
            releases: [
              yarnReleases.map((v) => {
                return { version: v };
              }),
            ],
          });
      }
      const execSnapshots = mockExecAll(exec, {
        stdout: yarnVersion,
        stderr: '',
      });
      const config = {
        constraints: {
          yarn: yarnCompatibility,
        },
      };
      const res = await yarnHelper.generateLockFile('some-dir', {}, config, [
        {
          depName: 'some-dep',
          newValue: '^1.0.0',
          isLockfileUpdate: true,
        },
        {
          depName: 'some-dep',
          newValue: '^1.0.0',
          isLockfileUpdate: true,
        },
      ]);
      expect(res.lockFile).toBe('package-lock-contents');
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    }
  );

  it.each([['1.22.0']])(
    'performs lock file updates and full install using yarn v%s',
    async (yarnVersion) => {
      Fixtures.mock(
        {
          'yarn.lock': 'package-lock-contents',
        },
        'some-dir'
      );
      const execSnapshots = mockExecAll(exec, {
        stdout: yarnVersion,
        stderr: '',
      });
      const res = await yarnHelper.generateLockFile('some-dir', {}, {}, [
        {
          depName: 'some-dep',
          isLockfileUpdate: true,
        },
      ]);
      expect(res.lockFile).toBe('package-lock-contents');
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    }
  );

  it.each([
    ['1.22.0', '^1.10.0', null, 2],
    ['2.1.0', '>= 2.0.0', ['2.1.0'], 1],
    ['2.2.0', '2.2.0', null, 1],
  ])(
    'performs lock file maintenance using yarn v%s',
    async (yarnVersion, yarnCompatibility, yarnReleases, expectedFsCalls) => {
      Fixtures.mock(
        {
          '.yarnrc': null,
          'yarn.lock': 'package-lock-contents',
        },
        'some-dir'
      );
      if (yarnReleases) {
        httpMock
          .scope('https://registry.npmjs.org')
          .get('/@yarnpkg%2Fcli')
          .reply(200, {
            releases: [
              yarnReleases.map((v) => {
                return { version: v };
              }),
            ],
          });
      }
      const execSnapshots = mockExecAll(exec, {
        stdout: yarnVersion,
        stderr: '',
      });
      const config = {
        constraints: {
          yarn: yarnCompatibility,
        },
        postUpdateOptions: ['yarnDedupeFewer', 'yarnDedupeHighest'],
      };
      const res = await yarnHelper.generateLockFile('some-dir', {}, config, [
        { isLockFileMaintenance: true },
      ]);
      expect(fs.readFile).toHaveBeenCalledTimes(expectedFsCalls);
      expect(fs.remove).toHaveBeenCalledTimes(1);
      expect(res.lockFile).toBeUndefined();
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    }
  );

  it.each([
    ['1.22.0', '^1.10.0'],
    ['2.1.0', '>= 2.0.0'],
  ])(
    'performs yarn binary update using yarn v%s',
    async (yarnVersion, yarnCompatibility) => {
      Fixtures.mock(
        {
          'yarn.lock': 'package-lock-contents',
        },
        'some-dir'
      );
      const execSnapshots = mockExecAll(exec, {
        stdout: yarnVersion,
        stderr: '',
      });
      const config = {
        constraints: {
          yarn: yarnCompatibility,
        },
      };
      const res = await yarnHelper.generateLockFile('some-dir', {}, config, [
        {
          depName: 'yarn',
          depType: 'packageManager',
          newValue: '3.0.1',
        },
      ]);
      expect(res.lockFile).toBe('package-lock-contents');
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    }
  );

  it('catches errors', async () => {
    Fixtures.mock({});
    const execSnapshots = mockExecAll(exec, {
      stdout: '1.9.4',
      stderr: 'some-error',
    });
    const res = await yarnHelper.generateLockFile('some-dir', {});
    expect(fs.readFile).toHaveBeenCalledTimes(2);
    expect(res.error).toBeTrue();
    expect(res.lockFile).toBeUndefined();
    expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
  });

  describe('checkYarnrc()', () => {
    it('returns offline mirror and yarn path', async () => {
      Fixtures.mock(
        {
          '.yarn/cli.js': '',
          '/tmp/renovate/.yarnrc':
            'yarn-offline-mirror "./packages-cache"\nyarn-path "/.yarn/cli.js"\n',
        },
        '/'
      );
      expect(await yarnHelper.checkYarnrc('/tmp/renovate')).toEqual({
        offlineMirror: true,
        yarnPath: '/.yarn/cli.js',
      });
    });

    it('returns no offline mirror and unquoted yarn path', async () => {
      Fixtures.mock(
        {
          '.yarn/cli.js': '',
          '/tmp/renovate/.yarnrc': 'yarn-path /.yarn/cli.js\n',
        },
        '/'
      );
      expect(await yarnHelper.checkYarnrc('/tmp/renovate')).toEqual({
        offlineMirror: false,
        yarnPath: '/.yarn/cli.js',
      });
    });

    it('returns offline mirror and no yarn path for non-existant yarn-path binary', async () => {
      Fixtures.mock(
        {
          '.yarnrc': 'yarn-path ./.yarn/cli.js\n',
        },
        '/tmp/renovate'
      );
      const { offlineMirror, yarnPath } = await yarnHelper.checkYarnrc(
        '/tmp/renovate'
      );
      expect(offlineMirror).toBeFalse();
      expect(yarnPath).toBeNull();
      expect(Fixtures.toJSON()['/tmp/renovate/.yarnrc']).toBe('\n');
    });
  });
});
