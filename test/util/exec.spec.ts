import {
  exec as _cpExec,
  ExecOptions as ChildProcessExecOptions,
} from 'child_process';
import { exec, ExecOptions } from '../../lib/util/exec';
import { setDockerUser } from '../../lib/util/exec/docker';
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

  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    processEnvOrig = process.env;
    trustLevelOrig = global.trustLevel;
    setDockerUser(undefined);
  });

  afterEach(() => {
    process.env = processEnvOrig;
    global.trustLevel = trustLevelOrig;
  });

  const image = 'example/image';
  const tag = '1.2.3';
  const cmd = 'echo hello';
  const cwd = '/current/working/directory';
  const volume_1 = '/path/to/volume-1';
  const volume_2 = '/path/to/volume-2';
  const volumes = [volume_1, volume_2];
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
        inOpts: { docker },
        outCmd: `docker run --rm ${image} ${cmd}`,
        outOpts: { encoding, env: envMock.basic },
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
      'Extra env vars with (Docker)',
      {
        processEnv,
        inCmd: cmd,
        inOpts: { docker, extraEnv: { SELECTED_ENV_VAR: 'Default value' } },
        outCmd: `docker run --rm -e SELECTED_ENV_VAR ${image} ${cmd}`,
        outOpts: { encoding, env: envMock.filtered },
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
        inOpts: { extraEnv: { SELECTED_ENV_VAR: 'Default value' } },
        outCmd: cmd,
        outOpts: {
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
        inOpts: { docker, extraEnv: { SELECTED_ENV_VAR: 'Default value' } },
        outCmd: `docker run --rm -e SELECTED_ENV_VAR ${image} ${cmd}`,
        outOpts: {
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
        },
        outCmd: `docker run --rm ${image} bash -l -c "echo \\"begin\\" && ${cmd} && echo 'end'"`,
        outOpts: { encoding, env: envMock.basic },
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
        },
        outCmd: `docker run --rm ${image} bash -l -c "${cmd} && echo 'end'"`,
        outOpts: { encoding, env: envMock.basic },
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
        },
        outCmd: `docker run --rm ${image} bash -l -c "echo \\"begin\\" && ${cmd}"`,
        outOpts: { encoding, env: envMock.basic },
      },
    ],

    [
      'Docker tags',
      {
        processEnv,
        inCmd: cmd,
        inOpts: { docker: { image, tag } },
        outCmd: `docker run --rm ${image}:${tag} ${cmd}`,
        outOpts: { encoding, env: envMock.basic },
      },
    ],

    [
      'Docker explicit CWD',
      {
        processEnv,
        inCmd: cmd,
        inOpts: { docker: { image }, cwd },
        outCmd: `docker run --rm -v "${cwd}":"${cwd}" -w "${cwd}" ${image} ${cmd}`,
        outOpts: { cwd, encoding, env: envMock.basic },
      },
    ],

    [
      'Docker volumes',
      {
        processEnv,
        inCmd: cmd,
        inOpts: { cwd, docker: { image, volumes } },
        outCmd: `docker run --rm -v "${volume_1}":"${volume_1}" -v "${volume_2}":"${volume_2}" -v "${cwd}":"${cwd}" -w "${cwd}" ${image} ${cmd}`,
        outOpts: { cwd, encoding, env: envMock.basic },
      },
    ],

    [
      'Docker user',
      {
        dockerUser: 'ubuntu',
        processEnv,
        inCmd: cmd,
        inOpts: { docker: { image } },
        outCmd: `docker run --rm --user=ubuntu ${image} ${cmd}`,
        outOpts: { encoding, env: envMock.basic },
      },
    ],

    [
      'Docker custom user',
      {
        dockerUser: 'foo',
        processEnv,
        inCmd: cmd,
        inOpts: { docker: { image, dockerUser: 'bar' } },
        outCmd: `docker run --rm --user=bar ${image} ${cmd}`,
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
    if (dockerUser) setDockerUser(dockerUser);

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
