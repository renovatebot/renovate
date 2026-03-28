import type { SendHandle, Serializable } from 'node:child_process';
import { Readable } from 'node:stream';
import { execa as _execa } from 'execa';
import { logger, partial } from '~test/util.ts';
import * as _instrumentation from '../../instrumentation/index.ts';
import { regEx } from '../regex.ts';
import {
  addSecretForSanitizing,
  clearGlobalSanitizedSecretsList,
  clearRepoSanitizedSecretsList,
} from '../sanitize.ts';
import { exec, rawExec } from './common.ts';
import { ExecError } from './exec-error.ts';
import type { DataListener, RawExecOptions } from './types.ts';

vi.mock('../../instrumentation/index.ts');
vi.mock('node:child_process');
vi.mock('execa');
vi.unmock('./common');

const instrument = vi.spyOn(_instrumentation, 'instrument');
const execa = vi.mocked(_execa);

type MessageListener = (message: Serializable, sendHandle: SendHandle) => void;
type NoArgListener = () => void;
type EndListener = (code: number | null, signal: NodeJS.Signals | null) => void;
type ErrorListener = (err: Error) => void;

type Listener = MessageListener | NoArgListener | EndListener | ErrorListener;

interface Events {
  close?: EndListener;
  disconnect?: NoArgListener;
  error?: ErrorListener;
  exit?: EndListener;
  message?: MessageListener;
  spawn?: NoArgListener;
}

interface StubArgs {
  cmd: string;
  exitCode: number | null;
  exitSignal: NodeJS.Signals | null;
  error?: Error;
  stdout?: string;
  stderr?: string;
  timeout?: number;
  pid?: number;
}

function getReadable(
  data: string | undefined,
  encoding: BufferEncoding,
): Readable {
  const readable = new Readable();
  readable._read = (_size: number): void => {
    /*do nothing*/
  };

  readable.destroy = (_error?: Error): Readable => {
    return readable;
  };

  if (data !== undefined) {
    readable.push(data, encoding);
    readable.push(null);
  }

  return readable;
}

// TODO: fix types, jest is using wrong overload (#22198)
function getSpawnStub(args: StubArgs): any {
  const {
    cmd,
    error,
    exitCode,
    exitSignal,
    stdout,
    stderr,
    timeout,
    pid = 31415,
  } = args;
  const listeners: Events = {};

  // init listeners
  const on = (name: string, cb: Listener) => {
    const event = name as keyof Events;
    if (listeners[event]) {
      return;
    }
    switch (event) {
      case 'exit':
        listeners.exit = cb as EndListener;
        break;
      case 'error':
        listeners.error = cb as ErrorListener;
        break;
      default:
        break;
    }
  };

  // init readable streams
  const stdoutStream = getReadable(stdout, 'utf8');
  const stderrStream = getReadable(stderr, 'utf8');

  // define class methods
  const emit = (name: string, ...arg: (string | number | Error)[]): boolean => {
    const event = name as keyof Events;

    switch (event) {
      case 'error':
        listeners.error?.(arg[0] as Error);
        break;
      case 'exit':
        listeners.exit?.(arg[0] as number, arg[1] as NodeJS.Signals);
        break;
      default:
        break;
    }

    return !!listeners[event];
  };

  const unref = (): void => {
    /* do nothing*/
  };

  const kill = (_signal?: number | NodeJS.Signals): boolean => {
    /* do nothing*/
    return true;
  };

  // queue events and wait for event loop to clear
  setTimeout(() => {
    if (error) {
      listeners.error?.(error);
    }
    listeners.exit?.(exitCode, exitSignal);
  }, 0);

  if (timeout) {
    setTimeout(() => {
      listeners.exit?.(null, 'SIGTERM');
    }, timeout);
  }

  return {
    on,
    spawnargs: cmd.split(regEx(/\s+/)),
    stdout: stdoutStream,
    stderr: stderrStream,
    emit,
    unref,
    kill,
    pid,
  };
}

function stringify(list: Buffer[]): string {
  return Buffer.concat(list).toString('utf8');
}

describe('util/exec/common', () => {
  const cmd = 'ls -l';
  const stdout = 'out message';
  const stderr = 'err message';

  beforeEach(() => {
    instrument.mockImplementationOnce((_name: string, fn: () => any) => fn());
  });

  describe('exec', () => {
    it('command exits with code 0', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 0,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);
      await expect(
        exec(cmd, partial<RawExecOptions>({ shell: 'bin/bash' })),
      ).resolves.toEqual({
        stderr,
        stdout,
      });
    });

    // GHSA-8wc6-vgrq-x6cf
    it('never extends the process environment', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 0,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await exec(cmd, partial<RawExecOptions>());

      expect(execa).toHaveBeenCalledWith(
        'ls',
        ['-l'],
        expect.objectContaining({ extendEnv: false }),
      );
    });

    it('throws if an error occurs, when using CommandWithOptions', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 1,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await expect(
        exec(
          { command: ['ls', '-l'] },
          partial<RawExecOptions>({ timeout: 5 }),
        ),
      ).rejects.toThrow(
        new ExecError(`Command failed: ls -l\nerr message`, {
          cmd: 'ls -l',
          exitCode: 1,
          stdout,
          stderr,
          options: { timeout: 5 },
        }),
      );
    });

    it('throws if an error occurs', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 1,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await expect(
        exec(cmd, partial<RawExecOptions>({ timeout: 5 })),
      ).rejects.toThrow(
        new ExecError(`Command failed: ls -l\nerr message`, {
          cmd: 'ls -l',
          exitCode: 1,
          stdout,
          stderr,
          options: { timeout: 5 },
        }),
      );
    });

    it('throws if an error occurs, and we specify ignoreFailure=false', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 1,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await expect(
        exec(
          { command: ['ls', '-l'], ignoreFailure: false },
          partial<RawExecOptions>({ timeout: 5 }),
        ),
      ).rejects.toThrow(
        new ExecError(`Command failed: ls -l\nerr message`, {
          cmd: 'ls -l',
          exitCode: 1,
          stdout,
          stderr,
          options: { timeout: 5 },
        }),
      );
    });

    it('does not throw if an error occurs, but we specify ignoreFailure=true', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 1,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await expect(
        exec(
          { command: ['ls', '-l'], ignoreFailure: true },
          partial<RawExecOptions>({ timeout: 5 }),
        ),
      ).resolves.toEqual({
        stderr,
        stdout,
        exitCode: 1,
      });

      expect(logger.logger.once.debug).toHaveBeenCalledWith(
        { command: 'ls -l', stdout, stderr, exitCode: 1 },
        'Ignoring failure to execute comamnd `ls -l`, as ignoreFailure=true is set',
      );
    });

    it('can specify a shell', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 0,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await exec(
        cmd,
        partial<RawExecOptions>({ encoding: 'utf8', shell: '/bin/zsh' }),
      );

      expect(execa).toHaveBeenCalledWith(
        cmd,
        [],
        expect.objectContaining({ shell: '/bin/zsh' }),
      );
    });

    it('can specify a specific shell with CommandWithOptions', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 0,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await exec(
        { command: ['ls', '-l'], shell: '/bin/zsh' },
        partial<RawExecOptions>({ encoding: 'utf8' }),
      );

      expect(execa).toHaveBeenCalledWith(
        cmd,
        [],
        expect.objectContaining({ shell: '/bin/zsh' }),
      );
    });

    it('can specify shell=true with CommandWithOptions', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 0,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await exec(
        { command: ['ls', '-l'], shell: true },
        partial<RawExecOptions>({ encoding: 'utf8' }),
      );

      expect(execa).toHaveBeenCalledWith(
        cmd,
        [],
        expect.objectContaining({ shell: true }),
      );
    });

    it('can specify a command with spaces, with a shell', async () => {
      const cmd = 'ls "Application Support"';
      const stub = getSpawnStub({
        cmd,
        exitCode: 0,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await exec(
        cmd,
        partial<RawExecOptions>({ encoding: 'utf8', shell: '/bin/zsh' }),
      );

      expect(execa).toHaveBeenCalledWith(
        cmd,
        [],
        expect.objectContaining({ shell: '/bin/zsh' }),
      );
    });

    it('can specify a command with spaces, with no shell', async () => {
      const cmd = 'ls "Application Support"';
      const stub = getSpawnStub({
        cmd,
        exitCode: 0,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await exec(
        cmd,
        partial<RawExecOptions>({ encoding: 'utf8', shell: false }),
      );

      expect(execa).toHaveBeenCalledWith(
        'ls',
        ['Application Support'],
        expect.objectContaining({ shell: false }),
      );
    });

    it('defaults to shell=false', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 0,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await exec(cmd, partial<RawExecOptions>({}));

      expect(execa).toHaveBeenCalledWith(
        'ls',
        ['-l'],
        expect.objectContaining({ shell: false }),
      );
    });

    it('the command is provided as a string with no arguments when shell is a string', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 0,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await exec(cmd, partial<RawExecOptions>({ shell: '/bin/fish' }));

      expect(execa).toHaveBeenCalledWith(
        'ls -l',
        [],
        expect.objectContaining({}),
      );
    });

    it('the command is provided as a string with no arguments when shell=true', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 0,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await exec(cmd, partial<RawExecOptions>({ shell: true }));

      expect(execa).toHaveBeenCalledWith(
        'ls -l',
        [],
        expect.objectContaining({}),
      );
    });

    it('the command is split into the command and arguments when shell=false', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 0,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await exec(cmd, partial<RawExecOptions>({}));

      expect(execa).toHaveBeenCalledWith(
        'ls',
        ['-l'],
        expect.objectContaining({ shell: false }),
      );
    });

    it('can specify shell=true', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 0,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await exec(
        cmd,
        partial<RawExecOptions>({ encoding: 'utf8', shell: true }),
      );

      expect(execa).toHaveBeenCalledWith(
        cmd,
        [],
        expect.objectContaining({ shell: true }),
      );
    });

    it('can specify shell=false', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 0,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await exec(
        cmd,
        partial<RawExecOptions>({ encoding: 'utf8', shell: false }),
      );

      expect(execa).toHaveBeenCalledWith(
        'ls',
        ['-l'],
        expect.objectContaining({ shell: false }),
      );
    });

    it('should invoke the output listeners', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 0,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      const stdoutListenerBuffer: Buffer[] = [];
      const stdoutListener: DataListener = (chunk: Buffer) => {
        stdoutListenerBuffer.push(chunk);
      };

      const stderrListenerBuffer: Buffer[] = [];
      const stderrListener: DataListener = (chunk: Buffer) => {
        stderrListenerBuffer.push(chunk);
      };

      await expect(
        exec(
          cmd,
          partial<RawExecOptions>({
            shell: 'bin/bash',
            outputListeners: {
              stdout: [stdoutListener],
              stderr: [stderrListener],
            },
          }),
        ),
      ).resolves.toEqual({
        stderr,
        stdout,
      });

      expect(stringify(stdoutListenerBuffer)).toEqual(stdout);
      expect(stringify(stderrListenerBuffer)).toEqual(stderr);
    });

    it('command exits with code 1', async () => {
      const cmd = 'ls -l';
      const stderr = 'err';
      const exitCode = 1;
      const stub = getSpawnStub({ cmd, exitCode, exitSignal: null, stderr });
      execa.mockImplementationOnce((_cmd, _opts) => stub);
      await expect(
        exec(cmd, partial<RawExecOptions>({})),
      ).rejects.toMatchObject({
        cmd,
        message: `Command failed: ${cmd}\n${stderr}`,
        exitCode,
        stderr,
      });
    });

    it('process terminated with SIGTERM', async () => {
      const cmd = 'ls -l';
      const exitSignal = 'SIGTERM';
      const stub = getSpawnStub({ cmd, exitCode: null, exitSignal });
      execa.mockImplementationOnce((_cmd, _opts) => stub);
      await expect(
        exec(cmd, partial<RawExecOptions>({})),
      ).rejects.toMatchObject({
        cmd,
        signal: exitSignal,
        message: `Command failed: ${cmd}\nInterrupted by ${exitSignal}`,
      });
    });

    it('process does nothing when signaled with SIGSTOP and eventually times out', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: null,
        exitSignal: 'SIGSTOP',
        timeout: 500,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);
      await expect(exec(cmd, partial<RawExecOptions>({}))).toReject();
    });

    it('process exits due to error', async () => {
      const cmd = 'ls -l';
      const errMsg = 'error message';
      const stub = getSpawnStub({
        cmd,
        exitCode: null,
        exitSignal: null,
        error: new Error(errMsg),
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);
      await expect(
        exec(cmd, partial<RawExecOptions>({})),
      ).rejects.toMatchObject({ cmd: 'ls -l', message: 'error message' });
    });

    it('process exits with error due to exceeded stdout maxBuffer', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: null,
        exitSignal: null,
        stdout: 'some message',
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);
      await expect(
        exec(
          cmd,
          partial<RawExecOptions>({
            maxBuffer: 5,
          }),
        ),
      ).rejects.toMatchObject({
        cmd: 'ls -l',
        message: 'stdout maxBuffer exceeded',
        stderr: '',
        stdout: '',
      });
    });

    it('process exits with error due to exceeded stderr maxBuffer', async () => {
      const stub = getSpawnStub({
        cmd,
        exitCode: null,
        exitSignal: null,
        stderr: 'some message',
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);
      await expect(
        exec(
          cmd,
          partial<RawExecOptions>({
            maxBuffer: 5,
          }),
        ),
      ).rejects.toMatchObject({
        cmd: 'ls -l',
        message: 'stderr maxBuffer exceeded',
        stderr: '',
        stdout: '',
      });
    });
  });

  describe('rawExec', () => {
    it('command exits with code 0', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 0,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);
      await expect(
        rawExec(cmd, partial<RawExecOptions>({ shell: 'bin/bash' })),
      ).resolves.toEqual({
        stderr,
        stdout,
      });
    });

    // GHSA-8wc6-vgrq-x6cf
    it('never extends the process environment', async () => {
      const cmd = 'ls -l';
      const stub = getSpawnStub({
        cmd,
        exitCode: 0,
        exitSignal: null,
        stdout,
        stderr,
      });
      execa.mockImplementationOnce((_cmd, _opts) => stub);

      await rawExec(cmd, partial<RawExecOptions>());

      expect(execa).toHaveBeenCalledWith(
        'ls',
        ['-l'],
        expect.objectContaining({ extendEnv: false }),
      );
    });

    describe('is instrumented', () => {
      beforeEach(() => {
        clearRepoSanitizedSecretsList();
        clearGlobalSanitizedSecretsList();
      });

      it('calls instrument function', async () => {
        const cmd = 'ls -l';
        const stub = getSpawnStub({
          cmd,
          exitCode: 0,
          exitSignal: null,
          stdout,
          stderr,
        });
        execa.mockImplementationOnce((_cmd, _opts) => stub);

        await rawExec(cmd, partial<RawExecOptions>({ shell: 'bin/bash' }));

        expect(instrument).toHaveBeenCalledTimes(1);
        expect(instrument).toHaveBeenCalledWith(
          'rawExec: ls -l',
          expect.any(Function),
        );
      });

      it('command name and arguments are sanitized', async () => {
        addSecretForSanitizing('ls', 'global');
        addSecretForSanitizing('npm_nOTValidSecret', 'repo');

        const cmd = 'ls -al /path/to/secret --npm-token npm_nOTValidSecret';
        const stub = getSpawnStub({
          cmd,
          exitCode: 0,
          exitSignal: null,
          stdout,
          stderr,
        });
        execa.mockImplementationOnce((_cmd, _opts) => stub);

        await rawExec(cmd, partial<RawExecOptions>({ shell: 'bin/bash' }));

        expect(instrument).toHaveBeenCalledTimes(1);
        expect(instrument).toHaveBeenCalledWith(
          'rawExec: **redacted** -al /path/to/secret --npm-token **redacted**',
          expect.any(Function),
        );
      });
    });
  });

  describe('handle gpid', () => {
    const killSpy = vi.spyOn(process, 'kill');

    afterEach(() => {
      delete process.env.RENOVATE_X_EXEC_GPID_HANDLE;
      vi.restoreAllMocks();
    });

    it('calls process.kill on the gpid', async () => {
      process.env.RENOVATE_X_EXEC_GPID_HANDLE = 'true';
      const cmd = 'ls -l';
      const exitSignal = 'SIGTERM';
      const stub = getSpawnStub({ cmd, exitCode: null, exitSignal });
      execa.mockImplementationOnce((_cmd, _opts) => stub);
      killSpy.mockImplementationOnce((_pid, _signal) => true);
      await expect(
        exec(cmd, partial<RawExecOptions>({})),
      ).rejects.toMatchObject({
        cmd,
        signal: exitSignal,
        message: `Command failed: ${cmd}\nInterrupted by ${exitSignal}`,
      });
      expect(process.kill).toHaveBeenCalledExactlyOnceWith(
        -stub.pid!,
        exitSignal,
      );
    });

    it('handles process.kill call on non existent gpid', async () => {
      process.env.RENOVATE_X_EXEC_GPID_HANDLE = 'true';
      const cmd = 'ls -l';
      const exitSignal = 'SIGTERM';
      const stub = getSpawnStub({ cmd, exitCode: null, exitSignal });
      execa.mockImplementationOnce((_cmd, _opts) => stub);
      killSpy.mockImplementationOnce((_pid, _signal) => {
        throw new Error();
      });
      await expect(
        exec(cmd, partial<RawExecOptions>({})),
      ).rejects.toMatchObject({
        cmd,
        signal: exitSignal,
        message: `Command failed: ${cmd}\nInterrupted by ${exitSignal}`,
      });
    });
  });
});
