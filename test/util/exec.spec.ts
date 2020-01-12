import {
  exec as _cpExec,
  ExecOptions as ChildProcessExecOptions,
} from 'child_process';
import { exec, ExecOptions } from '../../lib/util/exec';
import { setDockerConfig } from '../../lib/util/exec/docker';
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
  const defaultVolumes = `-v "${cacheDir}":"${cacheDir}" -v "${cwd}":"${cwd}"`;

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
        inOpts: { inheritEnvVars: ['SELECTED_ENV_VAR'] },
        outCmd: cmd,
        outOpts: { encoding, env: envMock.filtered },
      },
    ],

    [
      'Extra env vars with Docker',
      {
        processEnv,
        inCmd: cmd,
        inOpts: { docker, inheritEnvVars: ['SELECTED_ENV_VAR'], cwd },
        outCmd: `docker run --rm ${defaultVolumes} -e SELECTED_ENV_VAR ${defaultCwd} ${image} ${cmd}`,
        outOpts: { cwd, encoding, env: envMock.filtered },
      },
    ],

    [
      'Missing vars',
      {
        processEnv,
        inCmd: cmd,
        inOpts: { inheritEnvVars: ['NONSENSE'] },
        outCmd: cmd,
        outOpts: { encoding, env: envMock.basic },
      },
    ],

    [
      'Missing vars with Docker',
      {
        processEnv,
        inCmd: cmd,
        inOpts: { docker, inheritEnvVars: ['NONSENSE'], cwd },
        outCmd: `docker run --rm ${defaultVolumes} ${defaultCwd} ${image} ${cmd}`,
        outOpts: { cwd, encoding, env: envMock.basic },
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
            preCommands: ['echo "begin"'],
            postCommands: ["echo 'end'"],
          },
          cwd,
        },
        outCmd: `docker run --rm ${defaultVolumes} ${defaultCwd} ${image} bash -l -c "echo \\"begin\\" && ${cmd} && echo 'end'"`,
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
        outCmd: `docker run --rm ${defaultVolumes} -v "${volume_1}":"${volume_1}" -v "${volume_2}":"${volume_2}" -w "${cwd}" ${image} ${cmd}`,
        outOpts: { cwd, encoding, env: envMock.basic },
      },
    ],

    [
      'Docker user',
      {
        dockerUser: 'ubuntu',
        processEnv,
        inCmd: cmd,
        inOpts: { docker: { image }, cwd },
        outCmd: `docker run --rm --user=ubuntu ${defaultVolumes} ${defaultCwd} ${image} ${cmd}`,
        outOpts: { cwd, encoding, env: envMock.basic },
      },
    ],
  ];

  test.each(testInputs)('%s', async (_msg, testOpts) => {
    const {
      dockerUser,
      procEnv = processEnv,
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
