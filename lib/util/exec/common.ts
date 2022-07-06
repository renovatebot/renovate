import { ChildProcess, spawn } from 'child_process';
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

function stringify(stream: Buffer[], encoding: BufferEncoding): string {
  return Buffer.concat(stream).toString(encoding);
}

function initStreamListeners(
  cp: ChildProcess,
  opts: RawExecOptions & { maxBuffer: number; encoding: BufferEncoding }
): [Buffer[], Buffer[]] {
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let stdoutLen = 0;
  let stderrLen = 0;

  cp.stdout?.on('data', (data: Buffer) => {
    // process.stdout.write(data.toString());
    const len = Buffer.byteLength(data, opts.encoding);
    stdoutLen += len;
    if (stdoutLen > opts.maxBuffer) {
      cp.emit('error', new Error('exceeded max buffer size for stdout'));
    } else {
      stdout.push(data);
    }
  });
  cp.stderr?.on('data', (data: Buffer) => {
    // process.stderr.write(data.toString());
    const len = Buffer.byteLength(data, opts.encoding);
    stderrLen += len;
    if (stderrLen > opts.maxBuffer) {
      cp.emit('error', new Error('exceeded max buffer size for stderr'));
    } else {
      stderr.push(data);
    }
  });
  return [stdout, stderr];
}

export function exec(cmd: string, opts: RawExecOptions): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const encoding = opts.encoding as BufferEncoding;
    const [command, ...args] = cmd.split(/\s+/);
    const maxBuffer = opts.maxBuffer ?? 10 * 1024 * 1024; // Set default max buffer size to 10MB
    const cp = spawn(command, args, {
      ...opts,
      detached: true,
    }); // force detached

    // handle streams
    const [stdout, stderr] = initStreamListeners(cp, {
      ...opts,
      maxBuffer,
      encoding,
    });

    // handle process events
    cp.on('error', (error) => {
      reject(error.message);
    });

    cp.on('exit', (code: number, signal: string) => {
      if (signal && !NONTERM.includes(signal)) {
        try {
          // process.kill(-(cp.pid as number), signal); // PID range hack; signal process tree

          // destroying stdio is needed to unref to work
          // https://nodejs.org/api/child_process.html#subprocessunref
          // https://github.com/nodejs/node/blob/4d5ff25a813fd18939c9f76b17e36291e3ea15c3/lib/child_process.js#L412-L426
          cp.stderr?.destroy();
          cp.stdout?.destroy();
          cp.unref();
          cp.kill(signal as NodeJS.Signals);
        } catch (err) {
          // cp is a single node tree, therefore -pid is invalid,
        }
        stderr.push(
          Buffer.from(
            `PID= ${cp.pid as number}\n` +
              `COMMAND= "${cp.spawnargs.join(' ')}"\n` +
              `Signaled with "${signal}"`
          )
        );
        reject(stringify(stderr, encoding));
        return;
      }
      if (code !== 0) {
        reject(stringify(stderr, encoding));
        return;
      }
      resolve({
        stderr: stringify(stderr, encoding),
        stdout: stringify(stdout, encoding),
      });
    });
  });
}

// TODO: rename
export const rawExec: (
  cmd: string,
  opts: RawExecOptions
) => Promise<ExecResult> = exec; // TODO: rename
