import { mockDeep } from 'jest-mock-extended';
import { exec as cpExec, envMock } from '../../../test/exec-util';
import { mockedFunction } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import * as dockerModule from './docker';
import { getHermitEnvs } from './hermit';
import type { ExecOptions, RawExecOptions, VolumeOption } from './types';
import { exec } from '.';

const getHermitEnvsMock = mockedFunction(getHermitEnvs);

jest.mock('./hermit', () => ({
  ...jest.requireActual<typeof import('./hermit')>('./hermit'),
  getHermitEnvs: jest.fn(),
}));
jest.mock('../../modules/datasource', () => mockDeep());

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
    dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
  };

  beforeEach(() => {
    dockerModule.resetPrefetchedImages();
    jest.restoreAllMocks();
    processEnvOrig = process.env;
    GlobalConfig.reset();
  });

  afterEach(() => {
    process.env = processEnvOrig;
  });

  const image = dockerModule.sideCarImage;
  const fullImage = `ghcr.io/containerbase/sidecar`;
  const name = `renovate_${image}`;
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
  const encoding = 'utf-8';
  const docker = {};
  const processEnv = envMock.full;
  const dockerPullCmd = `docker pull ${fullImage}`;
  const dockerRemoveCmd = `docker ps --filter name=${name} -aq`;
  const dockerPullOpts = { encoding };
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
            encoding,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
          },
          {
            cwd,
            encoding,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
          },
          {
            cwd,
            encoding,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: { ...envMock.basic, FOO: 'BAR' },
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: envMock.full,
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: containerbaseEnv,
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: containerbaseEnvFiltered,
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: containerbaseEnvFiltered,
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: { ...containerbaseEnv, SELECTED_ENV_VAR: 'Default value' },
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: { ...containerbaseEnv, SELECTED_ENV_VAR: 'Default value' },
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: containerbaseEnv,
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: containerbaseEnv,
            timeout: 900000,
            maxBuffer: 10485760,
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
          `docker pull ghcr.io/containerbase/${image}`,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -e CONTAINERBASE_CACHE_DIR -w "${cwd}" ghcr.io/containerbase/${image} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            encoding,
            env: containerbaseEnv,
            timeout: 900000,
            maxBuffer: 10485760,
          },
        ],
        adminConfig: {
          dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
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
          `docker ps --filter name=myprefix_${image} -aq`,
          `docker run --rm --name=myprefix_${image} --label=myprefix_child ${defaultVolumes} -e CONTAINERBASE_CACHE_DIR -w "${cwd}" ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            encoding,
            env: containerbaseEnv,
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: containerbaseEnv,
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: containerbaseEnv,
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: containerbaseEnv,
            timeout: 20 * 60 * 1000,
            maxBuffer: 10485760,
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
            encoding,
            env: envMock.basic,
            timeout: 30 * 60 * 1000,
            maxBuffer: 10485760,
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
            encoding,
            env: containerbaseEnv,
            timeout: 900000,
            maxBuffer: 1024,
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
            encoding,
            env: {
              ...containerbaseEnv,
              CUSTOM_KEY: 'CUSTOM_VALUE',
            },
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: {
              ...containerbaseEnv,
              CUSTOM_KEY: 'CUSTOM_OVERRIDEN_VALUE',
            },
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: {
              ...containerbaseEnv,
              CUSTOM_KEY: 'CUSTOM_VALUE',
            },
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: {
              ...containerbaseEnv,
              CUSTOM_KEY: 'CUSTOM_OVERRIDEN_VALUE',
            },
            timeout: 900000,
            maxBuffer: 10485760,
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
            encoding,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
            stdio: ['pipe', 'ignore', 'pipe'],
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
            encoding,
            env: {
              ...envMock.basic,
              CUSTOM_KEY: 'CUSTOM_OVERRIDEN_VALUE',
              GOBIN: '/usr/src/app/repository-a/.hermit/go/bin',
              PATH: '/usr/src/app/repository-a/bin/;/home/user-a/bin;/usr/local/bin;',
            },
            timeout: 900000,
            maxBuffer: 10485760,
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
      actualCmd.push(execCmd);
      actualOpts.push(execOpts);

      return Promise.resolve({ stdout: '', stderr: '' });
    });
    GlobalConfig.set({ ...globalConfig, localDir: cwd, ...adminConfig });
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
      actualCmd.push(execCmd);
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
      `docker ps --filter name=renovate_${image} -aq`,
      `docker run --rm --name=renovate_${image} --label=renovate_child ${defaultCacheVolume} -e CONTAINERBASE_CACHE_DIR ${fullImage} bash -l -c "echo hello"`,
      `docker ps --filter name=renovate_${image} -aq`,
      `docker run --rm --name=renovate_${image} --label=renovate_child ${defaultCacheVolume} -e CONTAINERBASE_CACHE_DIR ${fullImage} bash -l -c "echo hello"`,
      `echo hello`,
      `echo hello`,
      `docker ps --filter name=renovate_${image} -aq`,
      `docker run --rm --name=renovate_${image} --label=renovate_child ${defaultCacheVolume} -e CONTAINERBASE_CACHE_DIR ${fullImage} bash -l -c "echo hello"`,
      `docker ps --filter name=renovate_${image} -aq`,
      `docker run --rm --name=renovate_${image} --label=renovate_child ${defaultCacheVolume} -e CONTAINERBASE_CACHE_DIR ${fullImage} bash -l -c "echo hello"`,
    ]);
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
      actualCmd.push(execCmd);
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

    const removeDockerContainerSpy = jest.spyOn(
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
    jest
      .spyOn(dockerModule, 'generateDockerCommand')
      .mockImplementation((): any => 'asdf');

    // The `removeDockerContainer` function is called once before it's used in the `catch` block.
    // We want it to fail in the catch block so we can assert the error is wrapped.
    let calledOnce = false;
    const removeDockerContainerSpy = jest.spyOn(
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
    const removeDockerContainerSpy = jest.spyOn(
      dockerModule,
      'removeDockerContainer',
    );
    const promise = exec('foobar', {});
    await expect(promise).rejects.toThrow(TEMPORARY_ERROR);
    expect(removeDockerContainerSpy).toHaveBeenCalledTimes(0);
  });
});
