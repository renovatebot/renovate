import * as child_process from 'child_process';
import type { ChildProcess } from 'child_process';
import { Readable } from 'stream';
import { partial } from '../../../test/util';
import { exec } from './common';
import type { RawExecOptions } from './types';

jest.mock('child_process');

function getReadable(
  data: string | undefined,
  encoding: BufferEncoding
): Readable {
  const readable = new Readable();
  readable._read = (size: number): void => {
    /*do nothing*/
  };

  readable.destroy = (error?: Error | undefined): Readable => {
    return readable;
  };

  if (data !== undefined) {
    readable.push(data, encoding);
    readable.push(null);
  }

  return readable;
}

interface StubArgs {
  cmd: string;
  exitCode: number | null;
  exitSignal: string | null;
  encoding?: BufferEncoding;
  error?: Error;
  stdout?: string;
  stderr?: string;
  timeout?: number;
}

function getSpawnStub(args: StubArgs): ChildProcess {
  const {
    cmd,
    error,
    exitCode,
    exitSignal,
    stdout,
    stderr,
    encoding,
    timeout,
  } = args;
  const listeners: any = {};

  // init listeners
  const on = (name: string, cb: any) => {
    if (!listeners[name]) {
      listeners[name] = cb;
    }
  };

  // init readable streams
  const stdoutStream = getReadable(stdout, encoding ?? 'utf8');
  const stderrStream = getReadable(stderr, encoding ?? 'utf8');

  // define class methods
  const emit = (event: string, arg: any): boolean => {
    if (listeners[event]) {
      listeners[event](arg);
      return true;
    }
    return false;
  };

  const unref = (): void => {
    /* do nothing*/
  };

  const kill = (signal?: number | NodeJS.Signals | undefined): boolean => {
    /* do nothing*/
    return true;
  };

  // queue events and wait for event loop to clear
  setTimeout(() => {
    if (error && listeners.error) {
      listeners.error(error);
    }
    if (listeners.exit) {
      listeners.exit(exitCode, exitSignal);
    }
  }, 0);

  if (timeout) {
    setTimeout(() => {
      listeners.exit(null, 'SIGTERM');
    }, timeout);
  }

  return {
    on,
    spawnargs: cmd.split(/\s+/),
    stdout: stdoutStream,
    stderr: stderrStream,
    emit,
    unref,
    kill,
  } as ChildProcess;
}

jest.mock('child_process');

describe('util/exec/common', () => {
  const spawnSpy = jest.spyOn(child_process, 'spawn');
  const cmd = 'ls -l';
  const stdout = 'out message';
  const stderr = 'err message';

  beforeEach(() => {
    jest.resetAllMocks();
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
      spawnSpy.mockImplementationOnce((cmd, opts) => stub);
      await expect(
        exec(
          cmd,
          partial<RawExecOptions>({ encoding: 'utf8', shell: 'bin/bash' })
        )
      ).resolves.toEqual({
        stderr,
        stdout,
      });
    });

    it('command exits with code 1', async () => {
      const cmd = 'ls -l';
      const stderr = 'err';
      const exitCode = 1;
      const stub = getSpawnStub({ cmd, exitCode, exitSignal: null, stderr });
      spawnSpy.mockImplementationOnce((cmd, opts) => stub);
      await expect(
        exec(cmd, partial<RawExecOptions>({ encoding: 'utf8' }))
      ).rejects.toMatchObject({
        cmd,
        message: 'Process exited with exit code "1"',
        exitCode,
        stderr,
      });
    });

    it('process terminated with SIGTERM', async () => {
      const cmd = 'ls -l';
      const exitSignal = 'SIGTERM';
      const stub = getSpawnStub({ cmd, exitCode: null, exitSignal });
      spawnSpy.mockImplementationOnce((cmd, opts) => stub);
      await expect(
        exec(cmd, partial<RawExecOptions>({ encoding: 'utf8' }))
      ).rejects.toMatchObject({
        cmd,
        signal: exitSignal,
        message: 'Process signaled with "SIGTERM"',
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
      spawnSpy.mockImplementationOnce((cmd, opts) => stub);
      await expect(
        exec(cmd, partial<RawExecOptions>({ encoding: 'utf8' }))
      ).toReject();
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
      spawnSpy.mockImplementationOnce((cmd, opts) => stub);
      await expect(
        exec(cmd, partial<RawExecOptions>({ encoding: 'utf8' }))
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
      spawnSpy.mockImplementationOnce((cmd, opts) => stub);
      await expect(
        exec(
          cmd,
          partial<RawExecOptions>({
            encoding: 'utf8',
            maxBuffer: 5,
          })
        )
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
      spawnSpy.mockImplementationOnce((cmd, opts) => stub);
      await expect(
        exec(
          cmd,
          partial<RawExecOptions>({
            encoding: 'utf8',
            maxBuffer: 5,
          })
        )
      ).rejects.toMatchObject({
        cmd: 'ls -l',
        message: 'stderr maxBuffer exceeded',
        stderr: '',
        stdout: '',
      });
    });
  });
});
