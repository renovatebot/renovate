import { ChildProcess, exec, spawn } from 'child_process';
import { promisify } from 'util';
import type {
  ExecResult,
  RawExecOptions,
  RawSpawnOptions,
  SpawnResult,
} from './types';

// https://man7.org/linux/man-pages/man7/signal.7.html#NAME
// Non TERM/CORE signals
// The following is step 3. in https://github.com/renovatebot/renovate/issues/16197#issuecomment-1171423890
// const NONTERM = [
//   'SIGCHLD',
//   'SIGCLD',
//   'SIGCONT',
//   'SIGSTOP',
//   'SIGTSTP',
//   'SIGTTIN',
//   'SIGTTOU',
//   'SIGURG',
//   'SIGWINCH',
// ];

function stringify(stream: Buffer[], encoding: BufferEncoding): string {
  return Buffer.concat(stream).toString(encoding);
}

function initStreamListeners(
  cp: ChildProcess,
  opts: RawSpawnOptions & { maxBuffer: number; encoding: BufferEncoding }
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

export function promisifiedSpawn(
  cmd: string,
  opts: RawSpawnOptions
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const encoding = opts.encoding as BufferEncoding;
    const [command, ...args] = cmd.split(/\s+/);
    const maxBuffer = opts.maxBuffer ?? 10 * 1024 * 1024; // Set default max buffer size to 10MB
    // The following is step 3. in https://github.com/renovatebot/renovate/issues/16197#issuecomment-1171423890
    // const cp = spawn(command, args, { ...opts, detached: true }); // PID range hack; force detached
    const cp = spawn(command, args, opts); // PID range hack; force detached
    const [stdout, stderr] = initStreamListeners(cp, {
      ...opts,
      maxBuffer,
      encoding,
    }); // handle streams
    // handle process events
    cp.on('error', (error) => {
      reject(error.message);
    });

    cp.on('exit', (code: number, signal: string) => {
      // The following is step 3. in https://github.com/renovatebot/renovate/issues/16197#issuecomment-1171423890
      // if (signal && !NONTERM.includes(signal)) {
      //   try {
      //     process.kill(-(cp.pid as number), signal); // PID range hack; signal process tree
      //   } catch (err) {
      //     // cp is a single node tree, therefore -pid is invalid,
      //   }
      //   stderr.push(
      //     Buffer.from(
      //       `PID= ${cp.pid as number}\n` +
      //         `COMMAND= "${cp.spawnargs.join(' ')}"\n` +
      //         `Signaled with "${signal}"`
      //     )
      //   );
      //   reject(stringify(stderr, encoding));
      //   return;
      // }
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

export const rawSpawn: (
  cmd: string,
  opts: RawSpawnOptions
) => Promise<SpawnResult> = promisifiedSpawn;

export const rawExec: (
  cmd: string,
  opts: RawExecOptions
) => Promise<ExecResult> = promisify(exec);
