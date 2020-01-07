import {
  exec as _cpExec,
  ExecOptions as ChildProcessExecOptions,
} from 'child_process';
import { exec, ExecOptions } from '../../lib/util/exec';

const cpExec: jest.Mock<typeof _cpExec> = _cpExec as any;
jest.mock('child_process');

const image = 'example/image';

const tag = '1.2.3';

const cmd = 'echo hello';

const cwd = '/current/working/directory';

const volume_1 = '/path/to/volume-1';
const volume_2 = '/path/to/volume-2';
const volumes = [volume_1, volume_2];

const dockerUser = 'ubuntu';

const encoding = 'utf-8';

const docker = { image };

describe(`Child process execution wrapper`, () => {
  // prettier-ignore
  test.each([
    // Transits env option
    [
      cmd,
      { env: { FOO: 'BAR' } },
      cmd,
      { encoding, env: { FOO: 'BAR' } }
    ],

    // Recognizes docker options
    [
      cmd,
      {},
      cmd,
      { encoding }
    ],
    [
      cmd,
      { docker },
      `docker run --rm ${image} ${cmd}`,
      { encoding },
    ],

    // Pre- and post-commands for Docker
    [
      cmd,
      {
        docker: {
          image,
          preCommands: ['echo "begin"'],
          postCommands: ['echo \'end\''],
        },
      },
      `docker run --rm ${image} bash -l -c "echo \\"begin\\" && ${cmd} && echo 'end'"`,
      { encoding },
    ],

    // Docker tags
    [
      cmd,
      { docker: { image, tag } },
      `docker run --rm ${image}:${tag} ${cmd}`,
      { encoding },
    ],

    // CWD mounting
    [
      cmd,
      { docker: { image }, cwd },
      `docker run --rm -v "${cwd}":"${cwd}" -w "${cwd}" ${image} ${cmd}`,
      { encoding, cwd },
    ],

    // Docker user
    [
      cmd,
      { docker: { image, dockerUser } },
      `docker run --rm --user=${dockerUser} ${image} ${cmd}`,
      { encoding },
    ],

    // Docker env vars
    [
      cmd,
      { docker: { image, envVars: ['FOO', 'BAR', 'FOO'] } },
      `docker run --rm -e FOO -e BAR ${image} ${cmd}`,
      { encoding },
    ],

    // Volumes mounting
    [
      cmd,
      { cwd, docker: { image, volumes } },
      `docker run --rm -v "${volume_1}":"${volume_1}" -v "${volume_2}":"${volume_2}" -v "${cwd}":"${cwd}" -w "${cwd}" ${image} ${cmd}`,
      { encoding, cwd },
    ],
  ])("%#: exec('%s', %j)", async (command, opts, expectedCmd, expectedOpts) => {
    let actualCmd: string | null = null;
    let actualOpts: ChildProcessExecOptions | null = null;
    cpExec.mockImplementationOnce((execCmd, execOpts, callback) => {
      actualCmd = execCmd;
      actualOpts = execOpts;
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    await exec(command as string, opts as ExecOptions);
    expect(actualCmd).toEqual(expectedCmd);
    expect(actualOpts).toEqual(expectedOpts);
  });
});
