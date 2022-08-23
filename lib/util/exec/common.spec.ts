import { spawn as _spawn } from 'child_process';
import type { ChildProcess, SendHandle, Serializable } from 'child_process';
import { Readable } from 'stream';
import { mockedFunction, partial } from '../../../test/util';
import { exec } from './common';
import type { RawExecOptions } from './types';

jest.mock('child_process');
const spawn = mockedFunction(_spawn);

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
  encoding?: BufferEncoding;
  error?: Error;
  stdout?: string;
  stderr?: string;
  timeout?: number;
}

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
  const stdoutStream = getReadable(stdout, encoding ?? 'utf8');
  const stderrStream = getReadable(stderr, encoding ?? 'utf8');

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

  const kill = (signal?: number | NodeJS.Signals | undefined): boolean => {
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
    spawnargs: cmd.split(/\s+/),
    stdout: stdoutStream,
    stderr: stderrStream,
    emit,
    unref,
    kill,
  } as ChildProcess;
}

describe('util/exec/common', () => {
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
      spawn.mockImplementationOnce((cmd, opts) => stub);
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
      spawn.mockImplementationOnce((cmd, opts) => stub);
      await expect(
        exec(cmd, partial<RawExecOptions>({ encoding: 'utf8' }))
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
      spawn.mockImplementationOnce((cmd, opts) => stub);
      await expect(
        exec(cmd, partial<RawExecOptions>({ encoding: 'utf8' }))
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
      spawn.mockImplementationOnce((cmd, opts) => stub);
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
      spawn.mockImplementationOnce((cmd, opts) => stub);
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
      spawn.mockImplementationOnce((cmd, opts) => stub);
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
      spawn.mockImplementationOnce((cmd, opts) => stub);
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
