import {
  exec as _cpExec,
  ExecOptions as ChildProcessExecOptions,
} from 'child_process';
import { exec, ExecOptions, setExecConfig } from '.';
import {
  BinarySource,
  ExecConfig,
  RawExecOptions,
  VolumeOption,
} from './common';
import { envMock } from '../../../test/execUtil';
import * as dockerModule from './docker';

const cpExec: jest.Mock<typeof _cpExec> = _cpExec as any;

jest.mock('child_process');

interface TestInput {
  execConfig: Partial<ExecConfig>;
  processEnv: Record<string, string>;
  inCmd: string | string[];
  inOpts: ExecOptions;
  outCmd: string[];
  outOpts: RawExecOptions[];
  trustLevel?: 'high' | 'low';
}

describe(`Child process execution wrapper`, () => {
  let processEnvOrig;
  let trustLevelOrig;

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
    trustLevelOrig = global.trustLevel;
  });

  afterEach(() => {
    process.env = processEnvOrig;
    global.trustLevel = trustLevelOrig;
  });

  const image = 'example/image';
  const name = image.replace(/\//g, '_');
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
  const dockerPullCmd = `docker pull ${image}`;
  const dockerRemoveCmd = `docker ps --filter name=${name} -aq | xargs --no-run-if-empty docker rm -f`;
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
        outOpts: [{ cwd, encoding, env: envMock.basic, timeout: 900000 }],
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
          { cwd, encoding, env: envMock.basic, timeout: 900000 },
          { cwd, encoding, env: envMock.basic, timeout: 900000 },
          { cwd, encoding, env: envMock.basic, timeout: 900000 },
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
        outOpts: [{ cwd, encoding, env: envMock.basic, timeout: 900000 }],
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
        outOpts: [{ cwd, encoding, env: envMock.full, timeout: 900000 }],
        trustLevel: 'high',
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
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} ${defaultCwd} ${image} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          { cwd, encoding, env: envMock.basic, timeout: 900000 },
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
        outOpts: [{ cwd, encoding, env: envMock.filtered, timeout: 900000 }],
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
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -e SELECTED_ENV_VAR ${defaultCwd} ${image} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          { cwd, encoding, env: envMock.filtered, timeout: 900000 },
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
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -e SELECTED_ENV_VAR ${defaultCwd} ${image} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          {
            cwd,
            encoding,
            env: { ...envMock.basic, SELECTED_ENV_VAR: 'Default value' },
            timeout: 900000,
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
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} ${defaultCwd} ${image}:${tag} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          { cwd, encoding, env: envMock.basic, timeout: 900000 },
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
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -v "${volume_1}":"${volume_1}" -v "${volume_2_from}":"${volume_2_to}" -w "${cwd}" ${image} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          { cwd, encoding, env: envMock.basic, timeout: 900000 },
        ],
      },
    ],

    [
      'Docker user',
      {
        execConfig: {
          ...execConfig,
          binarySource: BinarySource.Docker,
          dockerUser: 'foobar',
        },
        processEnv,
        inCmd,
        inOpts: { docker },
        outCmd: [
          dockerPullCmd,
          dockerRemoveCmd,
          `docker run --rm --name=${name} --label=renovate_child --user=foobar ${defaultVolumes} -w "${cwd}" ${image} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          { cwd, encoding, env: envMock.basic, timeout: 900000 },
        ],
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
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -w "${cwd}" ${image} bash -l -c "preCommand1 && preCommand2 && ${inCmd} && postCommand1 && postCommand2"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          { cwd, encoding, env: envMock.basic, timeout: 900000 },
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
          `docker run --rm --name=${name} --label=renovate_child ${defaultVolumes} -w "${cwd}" ${image} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          dockerRemoveOpts,
          { cwd, encoding, env: envMock.basic, timeout: 900000 },
        ],
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
      trustLevel,
    } = testOpts;

    process.env = procEnv;
    if (trustLevel) {
      global.trustLevel = trustLevel;
    }
    if (config) {
      setExecConfig(config);
    }

    const actualCmd: string[] = [];
    const actualOpts: ChildProcessExecOptions[] = [];
    cpExec.mockImplementation((execCmd, execOpts, callback) => {
      actualCmd.push(execCmd);
      actualOpts.push(execOpts);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });

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

    setExecConfig({ binarySource: BinarySource.Global });
    await exec(inCmd, { docker });
    await exec(inCmd, { docker });

    setExecConfig({ binarySource: BinarySource.Docker });
    await exec(inCmd, { docker });
    await exec(inCmd, { docker });

    setExecConfig({ binarySource: BinarySource.Global });
    await exec(inCmd, { docker });
    await exec(inCmd, { docker });

    setExecConfig({ binarySource: BinarySource.Docker });
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
    setExecConfig({ binarySource: BinarySource.Docker });
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
});
