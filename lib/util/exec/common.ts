import { ChildProcess, spawn } from 'child_process';
import { ExecError, ExecErrorData } from './exec-error';
import type { ExecResult, RawExecOptions } from './types';

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
  opts: RawExecOptions & { maxBuffer: number }
): [Buffer[], Buffer[]] {
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let stdoutLen = 0;
  let stderrLen = 0;

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

export function exec(cmd: string, opts: RawExecOptions): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const maxBuffer = opts.maxBuffer ?? 10 * 1024 * 1024; // Set default max buffer size to 10MB
    const cp = spawn(cmd, {
      ...opts,
      // force detached on non WIN platforms
      // https://github.com/nodejs/node/issues/21825#issuecomment-611328888
      detached: process.platform !== 'win32',
      shell: typeof opts.shell === 'string' ? opts.shell : true, // force shell
    });

    // handle streams
    const [stdout, stderr] = initStreamListeners(cp, {
      ...opts,
      maxBuffer,
    });

    // handle process events
    cp.on('error', (error) => {
      kill(cp, 'SIGTERM');
      // rethrowing, use originally emitted error message
      reject(new ExecError(error.message, rejectInfo(), error));
    });

    cp.on('exit', (code: number, signal: NodeJS.Signals) => {
      if (NONTERM.includes(signal)) {
        return;
      }
      if (signal) {
        kill(cp, signal);
        reject(
          new ExecError(`Command failed: ${cmd}\nInterrupted by ${signal}`, {
            ...rejectInfo(),
            signal,
          })
        );
        return;
      }
      if (code !== 0) {
        reject(
          new ExecError(`Command failed: ${cmd}\n${stringify(stderr)}`, {
            ...rejectInfo(),
            exitCode: code,
          })
        );
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
    if (cp.pid && process.env.RENOVATE_X_EXEC_GPID_HANDLE) {
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
  } catch (err) {
    // cp is a single node tree, therefore -pid is invalid as there is no such pgid,
    return false;
  }
}

export const rawExec: (
  cmd: string,
  opts: RawExecOptions
) => Promise<ExecResult> = exec;
