import type { ChildProcess } from 'node:child_process';
import type { Readable } from 'node:stream';
import { isNullOrUndefined } from '@sindresorhus/is';
import { execa } from 'execa';
import { join, split } from 'shlex';
import { instrument } from '../../instrumentation/index.ts';
import { logger } from '../../logger/index.ts';
import { getEnv } from '../env.ts';
import { sanitize } from '../sanitize.ts';
import type { ExecErrorData } from './exec-error.ts';
import { ExecError } from './exec-error.ts';
import type {
  CommandWithOptions,
  DataListener,
  ExecResult,
  RawExecOptions,
} from './types.ts';
import { asRawCommand, isCommandWithOptions } from './utils.ts';

// https://man7.org/linux/man-pages/man7/signal.7.html#NAME
// Non TERM/CORE signals
// The following is step 3. in https://github.com/renovatebot/renovate/issues/16197#issuecomment-1171423890
const NONTERM = [
  'SIGCHLD',
  'SIGCLD',
  'SIGCONT',
  'SIGSTOP',
  'SIGTSTP',
  'SIGTTIN',
  'SIGTTOU',
  'SIGURG',
  'SIGWINCH',
];

const encoding = 'utf8';

function stringify(list: Buffer[]): string {
  return Buffer.concat(list).toString(encoding);
}

function initStreamListeners(
  cp: ChildProcess,
  opts: RawExecOptions & { maxBuffer: number },
): [Buffer[], Buffer[]] {
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let stdoutLen = 0;
  let stderrLen = 0;

  registerDataListeners(cp.stdout, opts.outputListeners?.stdout);
  registerDataListeners(cp.stderr, opts.outputListeners?.stderr);

  cp.stdout?.on('data', (chunk: Buffer) => {
    // process.stdout.write(data.toString());
    const len = Buffer.byteLength(chunk, encoding);
    stdoutLen += len;
    if (stdoutLen > opts.maxBuffer) {
      cp.emit('error', new Error('stdout maxBuffer exceeded'));
    } else {
      stdout.push(chunk);
    }
  });

  cp.stderr?.on('data', (chunk: Buffer) => {
    // process.stderr.write(data.toString());
    const len = Buffer.byteLength(chunk, encoding);
    stderrLen += len;
    if (stderrLen > opts.maxBuffer) {
      cp.emit('error', new Error('stderr maxBuffer exceeded'));
    } else {
      stderr.push(chunk);
    }
  });
  return [stdout, stderr];
}

function registerDataListeners(
  readable: Readable | null,
  dataListeners: DataListener[] | undefined,
): void {
  if (isNullOrUndefined(readable) || isNullOrUndefined(dataListeners)) {
    return;
  }

  for (const listener of dataListeners) {
    readable.on('data', listener);
  }
}

export function exec(
  commandArgument: string | CommandWithOptions,
  opts: RawExecOptions,
): Promise<ExecResult> {
  let theCmd = commandArgument;
  let ignoreFailure = false;
  if (isCommandWithOptions(commandArgument)) {
    theCmd = join(commandArgument.command);
    if (commandArgument.ignoreFailure !== undefined) {
      ignoreFailure = commandArgument.ignoreFailure;
    }
  }

  return new Promise((resolve, reject) => {
    let cmd = asRawCommand(theCmd);
    let args: string[] = [];
    const maxBuffer = opts.maxBuffer ?? 10 * 1024 * 1024; // Set default max buffer size to 10MB

    // don't use shell by default, as it leads to potential security issues
    let shell = opts.shell ?? false;
    if (
      isCommandWithOptions(commandArgument) &&
      commandArgument.shell !== undefined
    ) {
      shell = commandArgument.shell;
    }

    // if we're not in shell mode, we need to provide the command and arguments
    if (shell === false) {
      const parts = split(cmd);
      // v8 ignore else -- TODO: add test #40625
      if (parts) {
        cmd = parts[0];
        args = parts.slice(1);
      }
    }

    const cp = execa(cmd, args, {
      ...opts,
      // force detached on non WIN platforms
      // https://github.com/nodejs/node/issues/21825#issuecomment-611328888
      detached: process.platform !== 'win32',
      shell,
      extendEnv: false,
    });

    // handle streams
    const [stdout, stderr] = initStreamListeners(cp, {
      ...opts,
      maxBuffer,
    });

    // handle process events
    void cp.on('error', (error) => {
      kill(cp, 'SIGTERM');
      // rethrowing, use originally emitted error message
      reject(new ExecError(error.message, rejectInfo(), error));
    });

    void cp.on('exit', (code: number, signal: NodeJS.Signals) => {
      if (NONTERM.includes(signal)) {
        return;
      }
      if (signal) {
        kill(cp, signal);
        reject(
          new ExecError(
            `Command failed: ${cp.spawnargs.join(' ')}\nInterrupted by ${signal}`,
            {
              ...rejectInfo(),
              signal,
            },
          ),
        );
        return;
      }
      if (code !== 0) {
        if (ignoreFailure === undefined || ignoreFailure === false) {
          reject(
            new ExecError(
              `Command failed: ${cp.spawnargs.join(' ')}\n${stringify(stderr)}`,
              {
                ...rejectInfo(),
                exitCode: code,
              },
            ),
          );
          return;
        }

        logger.once.debug(
          {
            command: cp.spawnargs.join(' '),
            stdout: stringify(stdout),
            stderr: stringify(stderr),
            exitCode: code,
          },
          `Ignoring failure to execute comamnd \`${cp.spawnargs.join(' ')}\`, as ignoreFailure=true is set`,
        );

        resolve({
          stderr: stringify(stderr),
          stdout: stringify(stdout),
          exitCode: code,
        });
        return;
      }
      resolve({
        stderr: stringify(stderr),
        stdout: stringify(stdout),
      });
    });

    function rejectInfo(): ExecErrorData {
      return {
        cmd: cp.spawnargs.join(' '),
        options: opts,
        stdout: stringify(stdout),
        stderr: stringify(stderr),
      };
    }
  });
}

function kill(cp: ChildProcess, signal: NodeJS.Signals): boolean {
  try {
    if (cp.pid && getEnv().RENOVATE_X_EXEC_GPID_HANDLE) {
      /**
       * If `pid` is negative, but not `-1`, signal shall be sent to all processes
       * (excluding an unspecified set of system processes),
       * whose process group ID (pgid) is equal to the absolute value of pid,
       * and for which the process has permission to send a signal.
       */
      return process.kill(-cp.pid, signal);
    } else {
      // destroying stdio is needed for unref to work
      // https://nodejs.org/api/child_process.html#subprocessunref
      // https://github.com/nodejs/node/blob/4d5ff25a813fd18939c9f76b17e36291e3ea15c3/lib/child_process.js#L412-L426
      cp.stderr?.destroy();
      cp.stdout?.destroy();
      cp.unref();
      return cp.kill(signal);
    }
  } catch {
    // cp is a single node tree, therefore -pid is invalid as there is no such pgid,
    return false;
  }
}

export const rawExec: (
  cmd: string | CommandWithOptions,
  opts: RawExecOptions,
) => Promise<ExecResult> = (
  cmd: string | CommandWithOptions,
  opts: RawExecOptions,
) =>
  instrument(`rawExec: ${sanitize(asRawCommand(cmd))}`, () => exec(cmd, opts));
