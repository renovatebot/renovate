/* eslint-disable @typescript-eslint/naming-convention */
import {
  ExecOptions as ChildProcessExecOptions,
  exec as _cpExec,
} from 'child_process';
import { envMock } from '../../../test/exec-util';
import { setGlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { RawExecOptions, VolumeOption } from './common';
import * as dockerModule from './docker';
import { ExecOptions, exec } from '.';

const cpExec: jest.Mock<typeof _cpExec> = _cpExec as any;

jest.mock('child_process');

interface TestInput {
  processEnv: Record<string, string>;
  inCmd: string | string[];
  inOpts: ExecOptions;
  outCmd: string[];
  outOpts: RawExecOptions[];
  adminConfig?: Partial<RepoGlobalConfig>;
}

describe('util/exec/index', () => {
  let processEnvOrig: NodeJS.ProcessEnv;

  const cacheDir = '/tmp/renovate/cache/';
  const cwd = '/tmp/renovate/github/some/repo/';

  const defaultCwd = `-w "${cwd}"`;
  const defaultVolumes = `-v "${cwd}":"${cwd}" -v "${cacheDir}":"${cacheDir}"`;

  beforeEach(() => {
    dockerModule.resetPrefetchedImages();
    jest.resetAllMocks();
    jest.restoreAllMocks();
    jest.resetModules();
    processEnvOrig = process.env;
    setGlobalConfig();
  });

  afterEach(() => {
    process.env = processEnvOrig;
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
            env: envMock.filtered,
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
            env: { ...envMock.basic, SELECTED_ENV_VAR: 'Default value' },
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
        adminConfig: { binarySource: 'docker' },
      },
    ],

    [
      'Docker tags',
      {
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
        adminConfig: { binarySource: 'docker' },
      },
    ],

    [
      'Docker volumes',
      {
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
        adminConfig: {
          dockerImagePrefix: 'ghcr.io/renovatebot',
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
        adminConfig: { binarySource: 'docker' },
      },
    ],

    [
      'Docker commands are nullable',
      {
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
            env: envMock.basic,
            timeout: 20 * 60 * 1000,
            maxBuffer: 10485760,
          },
        ],
        adminConfig: { binarySource: 'docker' },
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
            env: envMock.basic,
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
            env: { ...envMock.basic, CUSTOM_KEY: 'CUSTOM_VALUE' },
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
            env: { ...envMock.basic, CUSTOM_KEY: 'CUSTOM_OVERRIDEN_VALUE' },
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
          binarySource: 'docker',
        },
      },
    ],
  ];

  test.each(testInputs)('%s', async (_msg, testOpts) => {
    const {
      processEnv: procEnv,
      inCmd: cmd,
      inOpts,
      outCmd: outCommand,
      outOpts,
      adminConfig = {} as any,
    } = testOpts;

    process.env = procEnv;

    const actualCmd: string[] = [];
    const actualOpts: ChildProcessExecOptions[] = [];
    cpExec.mockImplementation((execCmd, execOpts, callback) => {
      actualCmd.push(execCmd);
      actualOpts.push(execOpts);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    setGlobalConfig({ cacheDir, localDir: cwd, ...adminConfig });
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

    setGlobalConfig({ binarySource: 'global' });
    await exec(inCmd, { docker });
    await exec(inCmd, { docker });

    setGlobalConfig({ binarySource: 'docker' });
    await exec(inCmd, { docker });
    await exec(inCmd, { docker });

    setGlobalConfig({ binarySource: 'global' });
    await exec(inCmd, { docker });
    await exec(inCmd, { docker });

    setGlobalConfig({ binarySource: 'docker' });
    await exec(inCmd, { docker });
    await exec(inCmd, { docker });

    // FIXME: explicit assert condition
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
    setGlobalConfig({ binarySource: 'docker' });
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
