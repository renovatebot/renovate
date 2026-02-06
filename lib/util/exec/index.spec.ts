import { mockDeep } from 'vitest-mock-extended';
import { GlobalConfig } from '../../config/global.ts';
import type { RepoGlobalConfig } from '../../config/types.ts';
import { TEMPORARY_ERROR } from '../../constants/error-messages.ts';
import type { UpdateArtifactsConfig } from '../../modules/manager/types.ts';
import { setCustomEnv } from '../env.ts';
import * as dockerModule from './docker/index.ts';
import { getHermitEnvs } from './hermit.ts';
import { exec, getToolSettingsOptions } from './index.ts';
import type {
  CommandWithOptions,
  ExecOptions,
  ExecResult,
  RawExecOptions,
  VolumeOption,
} from './types.ts';
import { asRawCommand } from './utils.ts';
import { exec as cpExec, envMock } from '~test/exec-util.ts';
import { logger } from '~test/util.ts';

const getHermitEnvsMock = vi.mocked(getHermitEnvs);

vi.mock('./hermit.ts', async () => ({
  ...(await vi.importActual<typeof import('./hermit.ts')>('./hermit')),
  getHermitEnvs: vi.fn(),
}));
vi.mock('../../modules/datasource/index.ts', () => mockDeep());

interface TestInput {
  processEnv: Record<string, string>;
  inCmd: string | string[];
  inOpts?: ExecOptions;
  outCmd: string[];
  outOpts: RawExecOptions[];
  adminConfig?: Partial<RepoGlobalConfig>;
  hermitEnvs?: Record<string, string>;
}

describe('util/exec/index', () => {
  let processEnvOrig: NodeJS.ProcessEnv;

  const cacheDir = '/tmp/renovate/cache/';
  const containerbaseDir = '/tmp/renovate/cache/containerbase';
  const cwd = '/tmp/renovate/github/some/repo/';

  const defaultCwd = `-w "${cwd}"`;
  const defaultCacheVolume = `-v "${cacheDir}":"${cacheDir}"`;
  const defaultVolumes = `-v "${cwd}":"${cwd}" ${defaultCacheVolume}`;

  const globalConfig: RepoGlobalConfig = {
    cacheDir,
    containerbaseDir,
    dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
  };

  beforeEach(() => {
    dockerModule.resetPrefetchedImages();
    vi.restoreAllMocks();
    processEnvOrig = process.env;
    GlobalConfig.reset();
    setCustomEnv({});
  });

  afterEach(() => {
    process.env = processEnvOrig;
  });

  const sideCarName = dockerModule.sideCarName;
  const fullImage = `ghcr.io/renovatebot/base-image`;
  const name = `renovate_${sideCarName}`;
  const inCmd = 'echo hello';
  const outCmd = ['echo hello'];
  const volume_1 = '/path/to/volume-1';
  const volume_2_from = '/path/to/volume-2';
  const volume_2_to = '/path/to/volume-3';
  const volumes: VolumeOption[] = [
    volume_1,
    null,
    undefined,
    [volume_2_from, volume_2_to],
  ];
  const docker = {};
  const processEnv = envMock.full;
  const dockerPullCmd = `docker pull ${fullImage}`;
  const dockerRemoveCmd = `docker ps --filter name=${name} -aq`;
  const dockerPullOpts = {};
  const dockerRemoveOpts = dockerPullOpts;

  const containerbaseEnv = {
    ...envMock.basic,
    CONTAINERBASE_CACHE_DIR: `${cacheDir}containerbase`,
  };
  const containerbaseEnvFiltered = {
    ...envMock.filtered,
    CONTAINERBASE_CACHE_DIR: `${cacheDir}containerbase`,
  };

  const testInputs: [string, TestInput][] = [
    [
      'Single command',
      {
        processEnv,
        inCmd,
        inOpts: {},
        outCmd,
        outOpts: [
          {
            cwd,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
      },
    ],

    [
      'Command without options',
      {
        processEnv,
        inCmd,
        inOpts: undefined,
        outCmd,
        outOpts: [
          {
            cwd,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
      },
    ],

    [
      'Multiple commands',
      {
        processEnv,
        inCmd: ['echo "begin"', inCmd, "echo 'end'"],
        inOpts: {},
        outCmd: ['echo "begin"', ...outCmd, "echo 'end'"],
        outOpts: [
          {
            cwd,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
          {
            cwd,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
          {
            cwd,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
      },
    ],

    [
      'Explicit env option',
      {
        processEnv,
        inCmd,
        inOpts: { env: { FOO: 'BAR' } },
        outCmd,
        outOpts: [
          {
            cwd,
            env: { ...envMock.basic, FOO: 'BAR' },
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
      },
    ],

    [
      'Low trust level',
      {
        processEnv,
        inCmd,
        inOpts: {},
        outCmd,
        outOpts: [
          {
            cwd,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
      },
    ],

    [
      'High trust level',
      {
        processEnv: envMock.full,
        inCmd,
        inOpts: {},
        outCmd,
        outOpts: [
          {
            cwd,
            env: envMock.full,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: { exposeAllEnv: true },
      },
    ],

    [
      'Docker',
      {
        processEnv,
        inCmd,
        inOpts: { docker, cwd },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -e CONTAINERBASE_CACHE_DIR ${defaultCwd} ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            env: containerbaseEnv,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: { binarySource: 'docker' },
      },
    ],

    [
      'Extra env vars',
      {
        processEnv,
        inCmd,
        inOpts: {
          extraEnv: {
            SELECTED_ENV_VAR: envMock.full.SELECTED_ENV_VAR,
            FILTERED_ENV_VAR: null,
            FOO: null,
            BAR: undefined,
          },
        },
        outCmd,
        outOpts: [
          {
            cwd,
            env: containerbaseEnvFiltered,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: { binarySource: 'docker' },
      },
    ],

    [
      'Extra env vars (Docker)',
      {
        processEnv,
        inCmd,
        inOpts: {
          docker,
          extraEnv: {
            SELECTED_ENV_VAR: envMock.full.SELECTED_ENV_VAR,
            FILTERED_ENV_VAR: null,
            FOO: null,
            BAR: undefined,
          },
          cwd,
        },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -e SELECTED_ENV_VAR -e CONTAINERBASE_CACHE_DIR ${defaultCwd} ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            env: containerbaseEnvFiltered,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: { binarySource: 'docker' },
      },
    ],

    [
      'Extra env vars defaults',
      {
        processEnv: envMock.basic,
        inCmd,
        inOpts: { cwd, extraEnv: { SELECTED_ENV_VAR: 'Default value' } },
        outCmd,
        outOpts: [
          {
            cwd,
            env: { ...containerbaseEnv, SELECTED_ENV_VAR: 'Default value' },
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: { binarySource: 'docker' },
      },
    ],

    [
      'Extra env vars defaults (Docker)',
      {
        processEnv: envMock.basic,
        inCmd,
        inOpts: {
          docker,
          extraEnv: { SELECTED_ENV_VAR: 'Default value' },
          cwd,
        },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -e SELECTED_ENV_VAR -e CONTAINERBASE_CACHE_DIR ${defaultCwd} ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            env: { ...containerbaseEnv, SELECTED_ENV_VAR: 'Default value' },
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: { binarySource: 'docker' },
      },
    ],

    [
      'Docker volumes',
      {
        processEnv,
        inCmd,
        inOpts: { cwd, docker: { volumes } },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -v "${volume_1}":"${volume_1}" -v "${volume_2_from}":"${volume_2_to}" -e CONTAINERBASE_CACHE_DIR -w "${cwd}" ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            env: containerbaseEnv,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: { binarySource: 'docker' },
      },
    ],

    [
      'Docker user',
      {
        processEnv,
        inCmd,
        inOpts: { docker },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child --user=foobar ${defaultVolumes} -e CONTAINERBASE_CACHE_DIR -w "${cwd}" ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            env: containerbaseEnv,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: {
          dockerUser: 'foobar',
          binarySource: 'docker',
        },
      },
    ],

    [
      'Docker image prefix',
      {
        processEnv,
        inCmd,
        inOpts: { docker },
        outCmd: [
          `docker pull ghcr.io/renovatebot/base-image`,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -e CONTAINERBASE_CACHE_DIR -w "${cwd}" ghcr.io/renovatebot/base-image bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            env: containerbaseEnv,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: {
          dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
          binarySource: 'docker',
        },
      },
    ],

    [
      'Docker child prefix',
      {
        processEnv,
        inCmd,
        inOpts: { docker },
        outCmd: [
          dockerPullCmd,
          `docker ps --filter name=myprefix_${sideCarName} -aq`,
          `docker run --rm --name=myprefix_${sideCarName} --label=myprefix_child ${defaultVolumes} -e CONTAINERBASE_CACHE_DIR -w "${cwd}" ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            env: containerbaseEnv,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: {
          dockerChildPrefix: 'myprefix_',
          binarySource: 'docker',
        },
      },
    ],

    [
      'Docker extra commands',
      {
        processEnv,
        inCmd,
        inOpts: {
          docker,
          preCommands: ['preCommand1', 'preCommand2', null as never],
        },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -e CONTAINERBASE_CACHE_DIR -w "${cwd}" ${fullImage} bash -l -c "preCommand1 && preCommand2 && ${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            env: containerbaseEnv,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: { binarySource: 'docker' },
      },
    ],

    [
      'Docker commands are nullable',
      {
        processEnv,
        inCmd,
        inOpts: { docker },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -e CONTAINERBASE_CACHE_DIR -w "${cwd}" ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            env: containerbaseEnv,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: { binarySource: 'docker' },
      },
    ],

    [
      'Explicit timeout',
      {
        processEnv,
        inCmd,
        inOpts: {
          timeout: 20 * 60 * 1000,
        },
        outCmd,
        outOpts: [
          {
            cwd,
            env: containerbaseEnv,
            timeout: 20 * 60 * 1000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: { binarySource: 'docker' },
      },
    ],

    [
      'Default timeout from executionTimeout config option',
      {
        processEnv,
        inCmd,
        inOpts: {},
        outCmd,
        outOpts: [
          {
            cwd,
            env: envMock.basic,
            timeout: 30 * 60 * 1000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: { executionTimeout: 30 },
      },
    ],

    [
      'Explicit maxBuffer',
      {
        processEnv,
        inCmd,
        inOpts: {
          maxBuffer: 1024,
        },
        outCmd,
        outOpts: [
          {
            cwd,
            env: containerbaseEnv,
            timeout: 900000,
            maxBuffer: 1024,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: { binarySource: 'docker' },
      },
    ],

    [
      'Custom environment variables for child',
      {
        processEnv: envMock.basic,
        inCmd,
        inOpts: {},
        outCmd,
        outOpts: [
          {
            cwd,
            env: {
              ...containerbaseEnv,
              CUSTOM_KEY: 'CUSTOM_VALUE',
            },
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: {
          customEnvVariables: {
            CUSTOM_KEY: 'CUSTOM_VALUE',
          },
          binarySource: 'docker',
        },
      },
    ],

    [
      'Custom environment variables for child should override',
      {
        processEnv: { ...envMock.basic, CUSTOM_KEY: 'CUSTOM_VALUE' },
        inCmd,
        inOpts: {},
        outCmd,
        outOpts: [
          {
            cwd,
            env: {
              ...containerbaseEnv,
              CUSTOM_KEY: 'CUSTOM_OVERRIDEN_VALUE',
            },
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: {
          customEnvVariables: {
            CUSTOM_KEY: 'CUSTOM_OVERRIDEN_VALUE',
          },
          binarySource: 'docker',
        },
      },
    ],

    [
      'Custom environment variables for child (Docker)',
      {
        processEnv,
        inCmd,
        inOpts: { docker, cwd },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -e CUSTOM_KEY -e CONTAINERBASE_CACHE_DIR ${defaultCwd} ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            env: {
              ...containerbaseEnv,
              CUSTOM_KEY: 'CUSTOM_VALUE',
            },
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: {
          customEnvVariables: {
            CUSTOM_KEY: 'CUSTOM_VALUE',
          },
          binarySource: 'docker',
        },
      },
    ],

    [
      'Custom environment variables for child should override (Docker)',
      {
        processEnv: { ...envMock.basic, CUSTOM_KEY: 'CUSTOM_VALUE' },
        inCmd,
        inOpts: { docker, cwd },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -e CUSTOM_KEY -e CONTAINERBASE_CACHE_DIR ${defaultCwd} ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            env: {
              ...containerbaseEnv,
              CUSTOM_KEY: 'CUSTOM_OVERRIDEN_VALUE',
            },
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        adminConfig: {
          customEnvVariables: {
            CUSTOM_KEY: 'CUSTOM_OVERRIDEN_VALUE',
          },
          binarySource: 'docker',
        },
      },
    ],

    [
      'Discarded stdout if ignoreStdout=true',
      {
        processEnv,
        inCmd,
        inOpts: {
          ignoreStdout: true,
          cwdFile: '/somefile',
        },
        outCmd,
        outOpts: [
          {
            cwd,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'ignore',
            stderr: 'pipe',
          },
        ],
      },
    ],

    [
      'Shell is not set if not specified',
      {
        processEnv,
        inCmd,
        inOpts: {},
        outCmd,
        outOpts: [
          {
            cwd,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
      },
    ],

    [
      'Shell=true is set if specified',
      {
        processEnv,
        inCmd,
        inOpts: {
          shell: true,
        },
        outCmd,
        outOpts: [
          {
            cwd,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
            shell: true,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
      },
    ],

    [
      'Shell={string} is set if specified',
      {
        processEnv,
        inCmd,
        inOpts: {
          shell: '/usr/bin/another-shell',
        },
        outCmd,
        outOpts: [
          {
            cwd,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
            shell: '/usr/bin/another-shell',
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
      },
    ],

    [
      'Hermit',
      {
        processEnv: {
          ...envMock.basic,
          CUSTOM_KEY: 'CUSTOM_VALUE',
          PATH: '/home/user-a/bin;/usr/local/bin',
        },
        inCmd,
        inOpts: {
          cwd,
        },
        outCmd: [inCmd],
        outOpts: [
          {
            cwd,
            env: {
              ...envMock.basic,
              CUSTOM_KEY: 'CUSTOM_OVERRIDEN_VALUE',
              GOBIN: '/usr/src/app/repository-a/.hermit/go/bin',
              PATH: '/usr/src/app/repository-a/bin/;/home/user-a/bin;/usr/local/bin;',
            },
            timeout: 900000,
            maxBuffer: 10485760,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
        hermitEnvs: {
          GOBIN: '/usr/src/app/repository-a/.hermit/go/bin',
          PATH: '/usr/src/app/repository-a/bin/;/home/user-a/bin;/usr/local/bin;',
        },
        adminConfig: {
          customEnvVariables: {
            CUSTOM_KEY: 'CUSTOM_OVERRIDEN_VALUE',
          },
          binarySource: 'hermit',
        },
      },
    ],
  ];

  it.each(testInputs)('%s', async (_msg, testOpts) => {
    const {
      processEnv: procEnv,
      inCmd: cmd,
      inOpts,
      outCmd: outCommand,
      outOpts,
      adminConfig = {} as any,
      hermitEnvs,
    } = testOpts;

    process.env = procEnv;

    const actualCmd: string[] = [];
    const actualOpts: RawExecOptions[] = [];
    cpExec.mockImplementation((execCmd, execOpts) => {
      actualCmd.push(asRawCommand(execCmd));
      actualOpts.push(execOpts);

      return Promise.resolve({ stdout: '', stderr: '' });
    });
    GlobalConfig.set({ ...globalConfig, localDir: cwd, ...adminConfig });
    setCustomEnv(adminConfig.customEnvVariables);
    if (hermitEnvs !== undefined) {
      getHermitEnvsMock.mockResolvedValue(hermitEnvs);
    }

    await exec(cmd as string, inOpts);

    expect(actualCmd).toEqual(outCommand);
    expect(actualOpts).toEqual(outOpts);
  });

  it('Supports image prefetch', async () => {
    process.env = processEnv;

    const actualCmd: string[] = [];
    cpExec.mockImplementation((execCmd) => {
      actualCmd.push(asRawCommand(execCmd));
      return Promise.resolve({ stdout: '', stderr: '' });
    });

    GlobalConfig.set({ ...globalConfig, binarySource: 'global' });
    await exec(inCmd, { docker });
    await exec(inCmd, { docker });

    GlobalConfig.set({ ...globalConfig, binarySource: 'docker' });
    await exec(inCmd, { docker });
    await exec(inCmd, { docker });

    GlobalConfig.set({ ...globalConfig, binarySource: 'global' });
    await exec(inCmd, { docker });
    await exec(inCmd, { docker });

    GlobalConfig.set({ ...globalConfig, binarySource: 'docker' });
    await exec(inCmd, { docker });
    await exec(inCmd, { docker });

    expect(actualCmd).toEqual([
      `echo hello`,
      `echo hello`,
      `docker pull ${fullImage}`,
      `docker ps --filter name=renovate_${sideCarName} -aq`,
      `docker run --rm --name=renovate_${sideCarName} --label=renovate_child ${defaultCacheVolume} -e CONTAINERBASE_CACHE_DIR ${fullImage} bash -l -c "echo hello"`,
      `docker ps --filter name=renovate_${sideCarName} -aq`,
      `docker run --rm --name=renovate_${sideCarName} --label=renovate_child ${defaultCacheVolume} -e CONTAINERBASE_CACHE_DIR ${fullImage} bash -l -c "echo hello"`,
      `echo hello`,
      `echo hello`,
      `docker ps --filter name=renovate_${sideCarName} -aq`,
      `docker run --rm --name=renovate_${sideCarName} --label=renovate_child ${defaultCacheVolume} -e CONTAINERBASE_CACHE_DIR ${fullImage} bash -l -c "echo hello"`,
      `docker ps --filter name=renovate_${sideCarName} -aq`,
      `docker run --rm --name=renovate_${sideCarName} --label=renovate_child ${defaultCacheVolume} -e CONTAINERBASE_CACHE_DIR ${fullImage} bash -l -c "echo hello"`,
    ]);
  });

  it('throws when an error is thrown', async () => {
    process.env = processEnv;
    cpExec.mockImplementation(() => {
      throw new Error('some error occurred');
    });
    GlobalConfig.set({ ...globalConfig, binarySource: 'install' });
    const promise = exec('foobar');
    await expect(promise).rejects.toThrow('some error occurred');
  });

  it('rejects and throws if an error is thrown, even if we specify ignoreFailure=true', async () => {
    process.env = processEnv;
    cpExec.mockImplementation(() => {
      throw new Error('some error occurred');
    });
    GlobalConfig.set({ ...globalConfig });
    const promise = exec([
      {
        command: ['foobar'],
        ignoreFailure: true,
      },
    ]);
    await expect(promise).rejects.toThrow('some error occurred');
  });

  it('does not reject and throw if rawExec returns an exit code, and we specify ignoreFailure=true', async () => {
    process.env = processEnv;
    const stdout = 'out';
    const stderr = 'err';
    cpExec.mockImplementation(
      (): Promise<ExecResult> =>
        // NOTE that this only makes sense as a return value when `ignoreFailure=true` is set
        Promise.resolve({
          stdout,
          stderr,
          exitCode: 10,
        }),
    );
    GlobalConfig.set({ ...globalConfig });
    const promise = exec([
      {
        command: ['foobar'],
        // NOTE that the implementation would only work if `ignoreFailure: true`
        ignoreFailure: true,
      },
    ]);
    await expect(promise).resolves.toEqual({
      stdout,
      stderr,
      exitCode: 10,
    });
  });

  it('exec takes an array with both `string`s and `CommandWithOptions` as an argument', async () => {
    const command: CommandWithOptions = {
      command: ['exit 1'],
      ignoreFailure: true,
    };

    cpExec.mockImplementationOnce(() => {
      return Promise.resolve({ stdout: '', stderr: '' });
    });

    cpExec.mockImplementationOnce(() => {
      return Promise.resolve({ stdout: 'out', stderr: 'err', exitCode: 5 });
    });

    await expect(exec(['ls', command])).resolves.toEqual({
      stdout: 'out',
      stderr: 'err',
      exitCode: 5,
    });
  });

  it('exec takes CommandWithOptions as an argument', async () => {
    const command: CommandWithOptions = {
      command: ['exit 1'],
      ignoreFailure: true,
    };

    cpExec.mockImplementation(() => {
      return Promise.resolve({ stdout: 'out', stderr: 'err', exitCode: 5 });
    });

    await expect(exec([command])).resolves.toEqual({
      stdout: 'out',
      stderr: 'err',
      exitCode: 5,
    });
  });

  it('Supports binarySource=install', async () => {
    process.env = processEnv;
    cpExec.mockImplementation(() => {
      throw new Error('some error occurred');
    });
    GlobalConfig.set({ ...globalConfig, binarySource: 'install' });
    process.env.CONTAINERBASE = 'true';
    const promise = exec('foobar', { toolConstraints: [{ toolName: 'npm' }] });
    await expect(promise).rejects.toThrow('No tool releases found.');
  });

  it('Supports binarySource=install preCommands', async () => {
    process.env = processEnv;
    const actualCmd: string[] = [];
    cpExec.mockImplementation((execCmd) => {
      actualCmd.push(asRawCommand(execCmd));
      return Promise.resolve({ stdout: '', stderr: '' });
    });

    GlobalConfig.set({ ...globalConfig, binarySource: 'install' });
    process.env.CONTAINERBASE = 'true';
    await exec('foobar', { preCommands: ['install-pip foobar'] });
    expect(actualCmd).toEqual([`install-pip foobar`, `foobar`]);
  });

  it('only calls removeDockerContainer in catch block is useDocker is set', async () => {
    cpExec.mockImplementation(() => {
      throw new Error('some error occurred');
    });

    const removeDockerContainerSpy = vi.spyOn(
      dockerModule,
      'removeDockerContainer',
    );

    const promise = exec('foobar', {});
    await expect(promise).rejects.toThrow('some error occurred');
    expect(removeDockerContainerSpy).toHaveBeenCalledTimes(0);
  });

  it('wraps error if removeDockerContainer throws an error', async () => {
    GlobalConfig.set({ ...globalConfig, binarySource: 'docker' });
    cpExec.mockImplementation(() => {
      throw new Error('some error occurred');
    });
    vi.spyOn(dockerModule, 'generateDockerCommand').mockImplementation(
      (): any => 'asdf',
    );

    // The `removeDockerContainer` function is called once before it's used in the `catch` block.
    // We want it to fail in the catch block so we can assert the error is wrapped.
    let calledOnce = false;
    const removeDockerContainerSpy = vi.spyOn(
      dockerModule,
      'removeDockerContainer',
    );
    removeDockerContainerSpy.mockImplementation((): Promise<void> => {
      if (!calledOnce) {
        calledOnce = true;
        return Promise.resolve();
      }

      return Promise.reject(new Error('removeDockerContainer failed'));
    });

    const promise = exec('foobar', { docker });
    await expect(promise).rejects.toThrow(
      new Error(
        'Error: "removeDockerContainer failed" - Original Error: "some error occurred"',
      ),
    );
    expect(removeDockerContainerSpy).toHaveBeenCalledTimes(2);
  });

  it('converts to TEMPORARY_ERROR', async () => {
    cpExec.mockImplementation(() => {
      class ErrorSignal extends Error {
        signal?: string;
      }
      const error = new ErrorSignal();
      error.signal = 'SIGTERM';
      throw error;
    });
    const removeDockerContainerSpy = vi.spyOn(
      dockerModule,
      'removeDockerContainer',
    );
    const promise = exec('foobar', {});
    await expect(promise).rejects.toThrow(TEMPORARY_ERROR);
    expect(removeDockerContainerSpy).toHaveBeenCalledTimes(0);
  });

  describe('getToolSettingsOptions()', () => {
    const config: UpdateArtifactsConfig = {
      newValue: '5.6.4',
    };

    describe('for JVM settings', () => {
      beforeEach(() => {
        GlobalConfig.set({
          toolSettings: { jvmMemory: 768, jvmMaxMemory: 800 },
        });

        // remove any test-specific overrides
        delete config.toolSettings;
      });

      it('returns default values if no global or repo config', () => {
        GlobalConfig.set({});

        const res = getToolSettingsOptions(undefined);

        expect(res).toMatchObject({
          jvmMemory: 512,
          jvmMaxMemory: 512,
        });
      });

      it('returns default values if empty repo config', () => {
        GlobalConfig.set({});

        const res = getToolSettingsOptions({});

        expect(res).toMatchObject({
          jvmMemory: 512,
          jvmMaxMemory: 512,
        });
      });

      it('returns default values if empty global config', () => {
        GlobalConfig.set({
          toolSettings: {},
        });

        const res = getToolSettingsOptions(undefined);

        expect(res).toMatchObject({
          jvmMemory: 512,
          jvmMaxMemory: 512,
        });
      });

      describe('does not allow floating point numbers', () => {
        it('in global config', () => {
          GlobalConfig.set({
            toolSettings: { jvmMemory: 512.5, jvmMaxMemory: 600.2 },
          });

          const res = getToolSettingsOptions(undefined);

          expect(res).toMatchObject({
            jvmMemory: 512,
            jvmMaxMemory: 600,
          });
        });

        it('in repo config', () => {
          GlobalConfig.set({
            toolSettings: { jvmMemory: 1024, jvmMaxMemory: 1024 },
          });

          config.toolSettings = {
            jvmMemory: 556.8,
            jvmMaxMemory: 600.4,
          };

          const res = getToolSettingsOptions(config.toolSettings);

          expect(res).toMatchObject({
            jvmMemory: 556,
            jvmMaxMemory: 600,
          });
        });
      });

      describe('when using repo config to override memory limits', () => {
        it('when below global settings, repo settings are used', () => {
          config.toolSettings = {
            jvmMemory: 512,
            jvmMaxMemory: 700,
          };

          const res = getToolSettingsOptions(config.toolSettings);

          expect(res).toMatchObject({
            jvmMemory: 512,
            jvmMaxMemory: 700,
          });
        });

        it('when repo settings are the same as global settings, they are used', () => {
          config.toolSettings = {
            jvmMemory: 512,
            jvmMaxMemory: 600,
          };

          const res = getToolSettingsOptions(config.toolSettings);

          expect(res).toMatchObject({
            jvmMemory: 512,
            jvmMaxMemory: 600,
          });
        });

        it('when repo jvmMemory setting is higher than global setting, but lower than global jvmMaxMemory, the repo config is used', () => {
          config.toolSettings = {
            jvmMemory: 600,
          };

          const res = getToolSettingsOptions(config.toolSettings);

          expect(res).toMatchObject({
            jvmMemory: 600,
          });
        });

        it('when repo jvmMaxMemory setting is lower than global settings, it is applied', () => {
          config.toolSettings = {
            jvmMaxMemory: 680,
          };

          const res = getToolSettingsOptions(config.toolSettings);

          expect(res).toMatchObject({
            jvmMaxMemory: 680,
          });
        });

        it('when repo jvmMaxMemory setting is lower than global jvmMemory, jvmMemory is set to the same value', () => {
          config.toolSettings = {
            jvmMaxMemory: 600,
          };

          const res = getToolSettingsOptions(config.toolSettings);

          expect(res).toMatchObject({
            jvmMemory: 600,
            jvmMaxMemory: 600,
          });
        });

        it('when repo jvmMaxMemory setting is lower than repo jvmMemory, jvmMemory is set to the same value', () => {
          config.toolSettings = {
            jvmMemory: 600,
            jvmMaxMemory: 600,
          };

          const res = getToolSettingsOptions(config.toolSettings);

          expect(res).toMatchObject({
            jvmMemory: 600,
            jvmMaxMemory: 600,
          });
        });

        it('when repo jvmMaxMemory setting is higher than global settings, they are ignored', () => {
          config.toolSettings = {
            jvmMaxMemory: 8192,
          };

          const res = getToolSettingsOptions(config.toolSettings);

          expect(res).toMatchObject({
            jvmMemory: 768,
            jvmMaxMemory: 800,
          });
        });

        it('when repo jvmMaxMemory setting is higher than global settings, a debug log is logged', () => {
          config.toolSettings = {
            jvmMaxMemory: 8192,
          };

          const res = getToolSettingsOptions(config.toolSettings);

          expect(logger.logger.once.debug).toHaveBeenCalledWith(
            'A higher jvmMaxMemory (8192) than the global configuration (800) is not permitted for Java VM invocations. Using global configuration instead',
          );

          expect(res).toMatchObject({
            jvmMemory: 768,
            jvmMaxMemory: 800,
          });
        });
      });

      // to provide a bit more safety to users, so they can't specify too little memory for Gradle
      describe('a minimum of 512M is enforced', () => {
        it('when global settings are lower than 512M, they are overridden to 512M', () => {
          GlobalConfig.set({
            toolSettings: { jvmMemory: 100, jvmMaxMemory: 127 },
          });

          const res = getToolSettingsOptions(undefined);

          expect(res).toMatchObject({
            jvmMemory: 512,
            jvmMaxMemory: 512,
          });
        });

        it('when global settings are lower than 512M, a debug log is logged', () => {
          GlobalConfig.set({
            toolSettings: { jvmMemory: 200, jvmMaxMemory: 255 },
          });

          getToolSettingsOptions(undefined);

          expect(logger.logger.once.debug).toHaveBeenCalledWith(
            'Overriding low memory settings for Java VM invocations to a minimum of 512M',
          );
        });

        it('when repo settings are lower than 512M, they are overridden to 512M', () => {
          config.toolSettings = {
            jvmMemory: 500,
            jvmMaxMemory: 511,
          };

          const res = getToolSettingsOptions(config.toolSettings);

          expect(res).toMatchObject({
            jvmMemory: 512,
            jvmMaxMemory: 512,
          });
        });

        it('when repo settings are lower than 512M, a debug log is logged', () => {
          config.toolSettings = {
            jvmMemory: 500,
            jvmMaxMemory: 511,
          };

          getToolSettingsOptions(config.toolSettings);

          expect(logger.logger.once.debug).toHaveBeenCalledWith(
            'Overriding low memory settings for Java VM invocations to a minimum of 512M',
          );
        });
      });
    });
  });
});
