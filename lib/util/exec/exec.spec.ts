/* eslint-disable @typescript-eslint/naming-convention */
import {
  ExecOptions as ChildProcessExecOptions,
  exec as _cpExec,
} from 'child_process';
import { envMock } from '../../../test/exec-util';
import { getName } from '../../../test/util';
import { setAdminConfig } from '../../config/admin';
import type { RepoAdminConfig } from '../../config/types';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import {
  BinarySource,
  ExecConfig,
  RawExecOptions,
  VolumeOption,
} from './common';
import * as dockerModule from './docker';
import { ExecOptions, exec, setExecConfig } from '.';

const cpExec: jest.Mock<typeof _cpExec> = _cpExec as any;

jest.mock('child_process');

interface TestInput {
  execConfig: Partial<ExecConfig>;
  processEnv: Record<string, string>;
  inCmd: string | string[];
  inOpts: ExecOptions;
  outCmd: string[];
  outOpts: RawExecOptions[];
  adminConfig?: RepoAdminConfig;
}

describe(getName(__filename), () => {
  let processEnvOrig: NodeJS.ProcessEnv;

  const cacheDir = '/tmp/renovate/cache/';
  const cwd = '/tmp/renovate/github/some/repo/';

  const defaultCwd = `-w "${cwd}"`;
  const defaultVolumes = `-v "${cwd}":"${cwd}" -v "${cacheDir}":"${cacheDir}"`;

  const execConfig = {
    cacheDir,
    localDir: cwd,
  };

  beforeEach(() => {
    dockerModule.resetPrefetchedImages();
    jest.resetAllMocks();
    jest.restoreAllMocks();
    jest.resetModules();
    processEnvOrig = process.env;
    setAdminConfig();
  });

  afterEach(() => {
    process.env = processEnvOrig;
    setAdminConfig();
  });

  const image = 'image';
  const fullImage = `renovate/${image}`;
  const name = `renovate_${image}`;
  const tag = '1.2.3';
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
  const docker = { image };
  const processEnv = envMock.full;
  const dockerPullCmd = `docker pull ${fullImage}`;
  const dockerRemoveCmd = `docker ps --filter name=${name} -aq`;
  const dockerPullOpts = { encoding };
  const dockerRemoveOpts = dockerPullOpts;

  const testInputs: [string, TestInput][] = [
    [
      'Single command',
      {
        execConfig,
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
      'Multiple commands',
      {
        execConfig,
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
        execConfig,
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
        execConfig,
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
        execConfig,
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
        execConfig: { ...execConfig, binarySource: BinarySource.Docker },
        processEnv,
        inCmd,
        inOpts: { docker, cwd },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} ${defaultCwd} ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
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
      'Extra env vars',
      {
        execConfig,
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
            env: envMock.filtered,
            timeout: 900000,
            maxBuffer: 10485760,
          },
        ],
      },
    ],

    [
      'Extra env vars (Docker)',
      {
        execConfig: { ...execConfig, binarySource: BinarySource.Docker },
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
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -e SELECTED_ENV_VAR ${defaultCwd} ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            encoding,
            env: envMock.filtered,
            timeout: 900000,
            maxBuffer: 10485760,
          },
        ],
      },
    ],

    [
      'Extra env vars defaults',
      {
        execConfig,
        processEnv: envMock.basic,
        inCmd,
        inOpts: { cwd, extraEnv: { SELECTED_ENV_VAR: 'Default value' } },
        outCmd,
        outOpts: [
          {
            cwd,
            encoding,
            env: { ...envMock.basic, SELECTED_ENV_VAR: 'Default value' },
            timeout: 900000,
            maxBuffer: 10485760,
          },
        ],
      },
    ],

    [
      'Extra env vars defaults (Docker)',
      {
        execConfig: { ...execConfig, binarySource: BinarySource.Docker },
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
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -e SELECTED_ENV_VAR ${defaultCwd} ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            encoding,
            env: { ...envMock.basic, SELECTED_ENV_VAR: 'Default value' },
            timeout: 900000,
            maxBuffer: 10485760,
          },
        ],
      },
    ],

    [
      'Docker tags',
      {
        execConfig: { ...execConfig, binarySource: BinarySource.Docker },
        processEnv,
        inCmd,
        inOpts: { docker: { image, tag }, cwd },
        outCmd: [
          `${dockerPullCmd}:${tag}`,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} ${defaultCwd} ${fullImage}:${tag} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
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
      'Docker volumes',
      {
        execConfig: { ...execConfig, binarySource: BinarySource.Docker },
        processEnv,
        inCmd,
        inOpts: { cwd, docker: { image, volumes } },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -v "${volume_1}":"${volume_1}" -v "${volume_2_from}":"${volume_2_to}" -w "${cwd}" ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
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
      'Docker user',
      {
        execConfig: {
          ...execConfig,
          binarySource: BinarySource.Docker,
        },
        processEnv,
        inCmd,
        inOpts: { docker },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child --user=foobar ${defaultVolumes} -w "${cwd}" ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            encoding,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
          },
        ],
        adminConfig: { dockerUser: 'foobar' },
      },
    ],

    [
      'Docker image prefix',
      {
        execConfig: {
          ...execConfig,
          binarySource: BinarySource.Docker,
        },
        processEnv,
        inCmd,
        inOpts: { docker },
        outCmd: [
          `docker pull ghcr.io/renovatebot/image`,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -w "${cwd}" ghcr.io/renovatebot/image bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            encoding,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
          },
        ],
        adminConfig: { dockerImagePrefix: 'ghcr.io/renovatebot' },
      },
    ],

    [
      'Docker child prefix',
      {
        execConfig: {
          ...execConfig,
          binarySource: BinarySource.Docker,
        },
        processEnv,
        inCmd,
        inOpts: { docker },
        outCmd: [
          dockerPullCmd,
          `docker ps --filter name=myprefix_${image} -aq`,
          `docker run --rm --name=myprefix_${image} --label=myprefix_child ${defaultVolumes} -w "${cwd}" ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            encoding,
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 10485760,
          },
        ],
        adminConfig: { dockerChildPrefix: 'myprefix_' },
      },
    ],

    [
      'Docker extra commands',
      {
        execConfig: {
          ...execConfig,
          binarySource: BinarySource.Docker,
        },
        processEnv,
        inCmd,
        inOpts: {
          docker: {
            image,
            preCommands: ['preCommand1', 'preCommand2', null],
            postCommands: ['postCommand1', undefined, 'postCommand2'],
          },
        },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -w "${cwd}" ${fullImage} bash -l -c "preCommand1 && preCommand2 && ${inCmd} && postCommand1 && postCommand2"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
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
      'Docker commands are nullable',
      {
        execConfig: {
          ...execConfig,
          binarySource: BinarySource.Docker,
        },
        processEnv,
        inCmd,
        inOpts: {
          docker: {
            image,
            preCommands: null,
            postCommands: undefined,
          },
        },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -w "${cwd}" ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
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
      'Explicit maxBuffer',
      {
        execConfig,
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
            env: envMock.basic,
            timeout: 900000,
            maxBuffer: 1024,
          },
        ],
      },
    ],

    [
      'Custom environment variables for child',
      {
        execConfig: {
          ...execConfig,
        },
        processEnv: envMock.basic,
        inCmd,
        inOpts: {},
        outCmd,
        outOpts: [
          {
            cwd,
            encoding,
            env: { ...envMock.basic, CUSTOM_KEY: 'CUSTOM_VALUE' },
            timeout: 900000,
            maxBuffer: 10485760,
          },
        ],
        adminConfig: {
          customEnvVariables: {
            CUSTOM_KEY: 'CUSTOM_VALUE',
          },
        },
      },
    ],

    [
      'Custom environment variables for child should override',
      {
        execConfig: {
          ...execConfig,
        },
        processEnv: { ...envMock.basic, CUSTOM_KEY: 'CUSTOM_VALUE' },
        inCmd,
        inOpts: {},
        outCmd,
        outOpts: [
          {
            cwd,
            encoding,
            env: { ...envMock.basic, CUSTOM_KEY: 'CUSTOM_OVERRIDEN_VALUE' },
            timeout: 900000,
            maxBuffer: 10485760,
          },
        ],
        adminConfig: {
          customEnvVariables: {
            CUSTOM_KEY: 'CUSTOM_OVERRIDEN_VALUE',
          },
        },
      },
    ],

    [
      'Custom environment variables for child (Docker)',
      {
        execConfig: {
          ...execConfig,
          binarySource: BinarySource.Docker,
        },
        processEnv,
        inCmd,
        inOpts: { docker, cwd },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -e CUSTOM_KEY ${defaultCwd} ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            encoding,
            env: { ...envMock.basic, CUSTOM_KEY: 'CUSTOM_VALUE' },
            timeout: 900000,
            maxBuffer: 10485760,
          },
        ],
        adminConfig: {
          customEnvVariables: {
            CUSTOM_KEY: 'CUSTOM_VALUE',
          },
        },
      },
    ],

    [
      'Custom environment variables for child should override (Docker)',
      {
        execConfig: {
          ...execConfig,
          binarySource: BinarySource.Docker,
        },
        processEnv: { ...envMock.basic, CUSTOM_KEY: 'CUSTOM_VALUE' },
        inCmd,
        inOpts: { docker, cwd },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -e CUSTOM_KEY ${defaultCwd} ${fullImage} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            encoding,
            env: { ...envMock.basic, CUSTOM_KEY: 'CUSTOM_OVERRIDEN_VALUE' },
            timeout: 900000,
            maxBuffer: 10485760,
          },
        ],
        adminConfig: {
          customEnvVariables: {
            CUSTOM_KEY: 'CUSTOM_OVERRIDEN_VALUE',
          },
        },
      },
    ],
  ];

  test.each(testInputs)('%s', async (_msg, testOpts) => {
    const {
      execConfig: config,
      processEnv: procEnv,
      inCmd: cmd,
      inOpts,
      outCmd: outCommand,
      outOpts,
      adminConfig = {} as any,
    } = testOpts;

    process.env = procEnv;

    if (config) {
      jest
        .spyOn(dockerModule, 'removeDanglingContainers')
        .mockResolvedValueOnce();
      await setExecConfig(config);
    }

    const actualCmd: string[] = [];
    const actualOpts: ChildProcessExecOptions[] = [];
    cpExec.mockImplementation((execCmd, execOpts, callback) => {
      actualCmd.push(execCmd);
      actualOpts.push(execOpts);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    setAdminConfig(adminConfig);
    await exec(cmd as string, inOpts);

    expect(actualCmd).toEqual(outCommand);
    expect(actualOpts).toEqual(outOpts);
  });

  it('Supports image prefetch', async () => {
    process.env = processEnv;

    const actualCmd: string[] = [];
    cpExec.mockImplementation((execCmd, execOpts, callback) => {
      actualCmd.push(execCmd);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });

    await setExecConfig({ binarySource: BinarySource.Global });
    await exec(inCmd, { docker });
    await exec(inCmd, { docker });

    await setExecConfig({ binarySource: BinarySource.Docker });
    await exec(inCmd, { docker });
    await exec(inCmd, { docker });

    await setExecConfig({ binarySource: BinarySource.Global });
    await exec(inCmd, { docker });
    await exec(inCmd, { docker });

    await setExecConfig({ binarySource: BinarySource.Docker });
    await exec(inCmd, { docker });
    await exec(inCmd, { docker });

    expect(actualCmd).toMatchSnapshot();
  });

  it('only calls removeDockerContainer in catch block is useDocker is set', async () => {
    cpExec.mockImplementation(() => {
      throw new Error('some error occurred');
    });

    const removeDockerContainerSpy = jest.spyOn(
      dockerModule,
      'removeDockerContainer'
    );

    const promise = exec('foobar', {});
    await expect(promise).rejects.toThrow('some error occurred');
    expect(removeDockerContainerSpy).toHaveBeenCalledTimes(0);
  });

  it('wraps error if removeDockerContainer throws an error', async () => {
    cpExec.mockImplementationOnce((_execCmd, _execOpts, callback) =>
      callback(null, { stdout: '', stderr: '' })
    );
    await setExecConfig({ binarySource: BinarySource.Docker });
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
      'removeDockerContainer'
    );
    removeDockerContainerSpy.mockImplementation((): any => {
      if (!calledOnce) {
        calledOnce = true;
        return Promise.resolve();
      }

      return Promise.reject(new Error('removeDockerContainer failed'));
    });

    const promise = exec('foobar', { docker });
    await expect(promise).rejects.toThrow(
      new Error(
        'Error: "removeDockerContainer failed" - Original Error: "some error occurred"'
      )
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
      'removeDockerContainer'
    );
    const promise = exec('foobar', {});
    await expect(promise).rejects.toThrow(TEMPORARY_ERROR);
    expect(removeDockerContainerSpy).toHaveBeenCalledTimes(0);
  });
});
