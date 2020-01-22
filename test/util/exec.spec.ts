import {
  exec as _cpExec,
  ExecOptions as ChildProcessExecOptions,
} from 'child_process';
import { exec, ExecOptions, setExecConfig } from '../../lib/util/exec';
import {
  BinarySource,
  ExecConfig,
  RawExecOptions,
  VolumeOption,
} from '../../lib/util/exec/common';
import { envMock } from '../execUtil';
import { resetPrefetchedImages } from '../../lib/util/exec/docker';

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

  function repeat<T = unknown>(opts: T, count = 2): T[] {
    const result = [];
    for (let idx = 0; idx < count; idx += 1) {
      result.push(opts);
    }
    return result;
  }

  beforeEach(() => {
    resetPrefetchedImages();
    jest.resetAllMocks();
    jest.resetModules();
    processEnvOrig = process.env;
    trustLevelOrig = global.trustLevel;
  });

  afterEach(() => {
    process.env = processEnvOrig;
    global.trustLevel = trustLevelOrig;
  });

  const image = 'example/image';
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
  const dockerPullOpts = { encoding };

  const testInputs: [string, TestInput][] = [
    [
      'Single command',
      {
        execConfig,
        processEnv,
        inCmd,
        inOpts: {},
        outCmd,
        outOpts: [{ cwd, encoding, env: envMock.basic }],
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
          { cwd, encoding, env: envMock.basic },
          { cwd, encoding, env: envMock.basic },
          { cwd, encoding, env: envMock.basic },
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
        outOpts: [{ cwd, encoding, env: { ...envMock.basic, FOO: 'BAR' } }],
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
        outOpts: [{ cwd, encoding, env: envMock.basic }],
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
        outOpts: [{ cwd, encoding, env: envMock.full }],
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
          `docker run --rm ${defaultVolumes} ${defaultCwd} ${image} bash -l -c "${inCmd}"`,
        ],
        outOpts: [dockerPullOpts, { cwd, encoding, env: envMock.basic }],
      },
    ],

    [
      'Extra env vars',
      {
        execConfig,
        processEnv,
        inCmd,
        inOpts: { extraEnv: { SELECTED_ENV_VAR: 'Default value' } },
        outCmd,
        outOpts: [{ cwd, encoding, env: envMock.filtered }],
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
          extraEnv: { SELECTED_ENV_VAR: 'Default value' },
          cwd,
        },
        outCmd: [
          dockerPullCmd,
          `docker run --rm ${defaultVolumes} -e SELECTED_ENV_VAR ${defaultCwd} ${image} bash -l -c "${inCmd}"`,
        ],
        outOpts: [dockerPullOpts, { cwd, encoding, env: envMock.filtered }],
      },
    ],

    [
      'Extra env vars with empty values',
      {
        execConfig,
        processEnv,
        inCmd,
        inOpts: {
          extraEnv: {
            SELECTED_ENV_VAR: null, // pick from process.env
            FOO: null,
            BAR: undefined,
          },
        },
        outCmd,
        outOpts: [{ cwd, encoding, env: envMock.filtered }],
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
          `docker run --rm ${defaultVolumes} -e SELECTED_ENV_VAR ${defaultCwd} ${image} bash -l -c "${inCmd}"`,
        ],
        outOpts: [
          dockerPullOpts,
          {
            cwd,
            encoding,
            env: { ...envMock.basic, SELECTED_ENV_VAR: 'Default value' },
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
          `docker run --rm ${defaultVolumes} ${defaultCwd} ${image}:${tag} bash -l -c "${inCmd}"`,
        ],
        outOpts: [dockerPullOpts, { cwd, encoding, env: envMock.basic }],
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
          `docker run --rm ${defaultVolumes} -v "${volume_1}":"${volume_1}" -v "${volume_2_from}":"${volume_2_to}" -w "${cwd}" ${image} bash -l -c "${inCmd}"`,
        ],
        outOpts: [dockerPullOpts, { cwd, encoding, env: envMock.basic }],
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
        inOpts: { docker: { image } },
        outCmd: [
          dockerPullCmd,
          `docker run --rm --user=foobar ${defaultVolumes} -w "${cwd}" ${image} bash -l -c "${inCmd}"`,
        ],
        outOpts: [dockerPullOpts, { cwd, encoding, env: envMock.basic }],
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
    if (trustLevel) global.trustLevel = trustLevel;
    if (config) setExecConfig(config);

    const actualCmd: string[] = [];
    const actualOpts: ChildProcessExecOptions[] = [];
    cpExec.mockImplementation((execCmd, execOpts, callback) => {
      actualCmd.push(execCmd);
      actualOpts.push(execOpts);
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });

    await exec(cmd as string, inOpts as ExecOptions);

    expect(actualCmd).toEqual(outCommand);
    expect(actualOpts).toEqual(outOpts);
  });

  it('Supports image prefetch', async () => {
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

    expect(actualCmd).toEqual([
      ...repeat(inCmd),
      dockerPullCmd,
      ...repeat(`docker run --rm ${image} bash -l -c "${inCmd}"`),
      ...repeat(inCmd),
      ...repeat(`docker run --rm ${image} bash -l -c "${inCmd}"`),
    ]);
  });
});
