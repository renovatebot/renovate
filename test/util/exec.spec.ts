import {
  exec as _cpExec,
  ExecOptions as ChildProcessExecOptions,
} from 'child_process';
import { exec, ExecOptions } from '../../lib/util/exec';
import { setDockerConfig, VolumeOption } from '../../lib/util/exec/docker';
import { envMock } from '../execUtil';

const cpExec: jest.Mock<typeof _cpExec> = _cpExec as any;

jest.mock('child_process');

interface TestInput {
  dockerUser?: string;
  processEnv: Record<string, string>;
  inCmd: string;
  inOpts: ExecOptions;
  outCmd: string;
  outOpts: ChildProcessExecOptions & { encoding: string };
  trustLevel?: 'high' | 'low' | unknown;
}

describe(`Child process execution wrapper`, () => {
  let processEnvOrig;
  let trustLevelOrig;

  const cacheDir = '/tmp/renovate/cache/';
  const cwd = '/tmp/renovate/github/some/repo/';

  const defaultCwd = `-w "${cwd}"`;
  const defaultVolumes = `-v "${cwd}":"${cwd}" -v "${cacheDir}":"${cacheDir}"`;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    processEnvOrig = process.env;
    trustLevelOrig = global.trustLevel;
    setDockerConfig({
      cacheDir,
      localDir: cwd,
    });
  });

  afterEach(() => {
    process.env = processEnvOrig;
    global.trustLevel = trustLevelOrig;
  });

  const image = 'example/image';
  const tag = '1.2.3';
  const cmd = 'echo hello';
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

  const testInputs: [string, TestInput][] = [
    [
      'Explicit env option',
      {
        processEnv,
        inCmd: cmd,
        inOpts: { env: { FOO: 'BAR' } },
        outCmd: cmd,
        outOpts: { encoding, env: { ...envMock.basic, FOO: 'BAR' } },
      },
    ],

    [
      'Low trust level',
      {
        processEnv,
        inCmd: cmd,
        inOpts: {},
        outCmd: cmd,
        outOpts: { encoding, env: envMock.basic },
      },
    ],

    [
      'High trust level',
      {
        processEnv: envMock.full,
        inCmd: cmd,
        inOpts: {},
        outCmd: cmd,
        outOpts: { encoding, env: envMock.full },
        trustLevel: 'high',
      },
    ],

    [
      'Docker',
      {
        processEnv,
        inCmd: cmd,
        inOpts: { docker, cwd },
        outCmd: `docker run --rm ${defaultVolumes} ${defaultCwd} ${image} ${cmd}`,
        outOpts: { cwd, encoding, env: envMock.basic },
      },
    ],

    [
      'Extra env vars',
      {
        processEnv,
        inCmd: cmd,
        inOpts: { extraEnv: { SELECTED_ENV_VAR: 'Default value' } },
        outCmd: cmd,
        outOpts: { encoding, env: envMock.filtered },
      },
    ],

    [
      'Extra env vars (Docker)',
      {
        processEnv,
        inCmd: cmd,
        inOpts: {
          docker,
          extraEnv: { SELECTED_ENV_VAR: 'Default value' },
          cwd,
        },
        outCmd: `docker run --rm ${defaultVolumes} -e SELECTED_ENV_VAR ${defaultCwd} ${image} ${cmd}`,
        outOpts: { cwd, encoding, env: envMock.filtered },
      },
    ],

    [
      'Extra env vars with empty values',
      {
        processEnv,
        inCmd: cmd,
        inOpts: {
          extraEnv: {
            SELECTED_ENV_VAR: null, // pick from process.env
            FOO: null,
            BAR: undefined,
          },
        },
        outCmd: cmd,
        outOpts: { encoding, env: envMock.filtered },
      },
    ],

    [
      'Extra env vars defaults',
      {
        processEnv: envMock.basic,
        inCmd: cmd,
        inOpts: { cwd, extraEnv: { SELECTED_ENV_VAR: 'Default value' } },
        outCmd: cmd,
        outOpts: {
          cwd,
          encoding,
          env: { ...envMock.basic, SELECTED_ENV_VAR: 'Default value' },
        },
      },
    ],

    [
      'Extra env vars defaults (Docker)',
      {
        processEnv: envMock.basic,
        inCmd: cmd,
        inOpts: {
          docker,
          extraEnv: { SELECTED_ENV_VAR: 'Default value' },
          cwd,
        },
        outCmd: `docker run --rm ${defaultVolumes} -e SELECTED_ENV_VAR ${defaultCwd} ${image} ${cmd}`,
        outOpts: {
          cwd,
          encoding,
          env: { ...envMock.basic, SELECTED_ENV_VAR: 'Default value' },
        },
      },
    ],

    [
      'Docker pre/post commands',
      {
        processEnv,
        inCmd: cmd,
        inOpts: {
          docker: {
            image,
            preCommands: ['echo "begin"', null],
            postCommands: [undefined, "echo 'end'"],
          },
          cwd,
        },
        outCmd: `docker run --rm ${defaultVolumes} ${defaultCwd} ${image} bash -l -c "echo \\"begin\\" && ${cmd} && echo 'end'"`,
        outOpts: { cwd, encoding, env: envMock.basic },
      },
    ],

    [
      'Docker empty pre-commands',
      {
        processEnv,
        inCmd: cmd,
        inOpts: {
          docker: {
            image,
            preCommands: null,
            postCommands: ["echo 'end'"],
          },
          cwd,
        },
        outCmd: `docker run --rm ${defaultVolumes} ${defaultCwd} ${image} bash -l -c "${cmd} && echo 'end'"`,
        outOpts: { cwd, encoding, env: envMock.basic },
      },
    ],

    [
      'Docker empty post-commands',
      {
        processEnv,
        inCmd: cmd,
        inOpts: {
          docker: {
            image,
            preCommands: ['echo "begin"'],
            postCommands: undefined,
          },
          cwd,
        },
        outCmd: `docker run --rm ${defaultVolumes} ${defaultCwd} ${image} bash -l -c "echo \\"begin\\" && ${cmd}"`,
        outOpts: { cwd, encoding, env: envMock.basic },
      },
    ],

    [
      'Docker tags',
      {
        processEnv,
        inCmd: cmd,
        inOpts: { docker: { image, tag }, cwd },
        outCmd: `docker run --rm ${defaultVolumes} ${defaultCwd} ${image}:${tag} ${cmd}`,
        outOpts: { cwd, encoding, env: envMock.basic },
      },
    ],

    [
      'Docker volumes',
      {
        processEnv,
        inCmd: cmd,
        inOpts: { cwd, docker: { image, volumes } },
        outCmd: `docker run --rm ${defaultVolumes} -v "${volume_1}":"${volume_1}" -v "${volume_2_from}":"${volume_2_to}" -w "${cwd}" ${image} ${cmd}`,
        outOpts: { cwd, encoding, env: envMock.basic },
      },
    ],

    [
      'Docker user',
      {
        dockerUser: 'foobar',
        processEnv,
        inCmd: cmd,
        inOpts: { docker: { image } },
        outCmd: `docker run --rm --user=foobar ${defaultVolumes} ${image} ${cmd}`,
        outOpts: { encoding, env: envMock.basic },
      },
    ],
  ];

  test.each(testInputs)('%s', async (_msg, testOpts) => {
    const {
      dockerUser,
      processEnv: procEnv,
      inCmd,
      inOpts,
      outCmd,
      outOpts,
      trustLevel,
    } = testOpts as any;

    process.env = procEnv;
    if (trustLevel) global.trustLevel = trustLevel;
    if (dockerUser) setDockerConfig({ cacheDir, localDir: cwd, dockerUser });

    let actualCmd: string | null = null;
    let actualOpts: ChildProcessExecOptions | null = null;
    cpExec.mockImplementationOnce((execCmd, execOpts, callback) => {
      actualCmd = execCmd;
      actualOpts = execOpts;
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });

    await exec(inCmd as string, inOpts as ExecOptions);

    expect(actualCmd).toEqual(outCmd);
    expect(actualOpts).toEqual(outOpts);
  });
});
