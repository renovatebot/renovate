import { SpawnOptions, spawn } from 'child_process';
import { Readable } from 'stream';

export type Opt<T> = T | null | undefined;

export enum BinarySource {
  Auto = 'auto',
  Docker = 'docker',
  Global = 'global',
}

export interface ExecConfig {
  binarySource: Opt<BinarySource>;
  dockerUser: Opt<string>;
  localDir: Opt<string>;
  cacheDir: Opt<string>;
}

export type VolumesPair = [string, string];
export type VolumeOption = Opt<string | VolumesPair>;

export type DockerExtraCommand = Opt<string>;
export type DockerExtraCommands = Opt<DockerExtraCommand[]>;

export interface DockerOptions {
  image: string;
  tag?: Opt<string>;
  tagScheme?: Opt<string>;
  tagConstraint?: Opt<string>;
  volumes?: Opt<VolumeOption[]>;
  envVars?: Opt<Opt<string>[]>;
  cwd?: Opt<string>;
  preCommands?: DockerExtraCommands;
  postCommands?: DockerExtraCommands;
}

export type RawExecOptions = SpawnOptions;

export interface ExecResult {
  stdout: string;
  stderr: string;
}

interface ChildProcess {
  stdout: Readable;
  stderr: Readable;

  on(event: string | symbol, listener: (...args: any[]) => void): this;
}

function pipeStreamToBuffers(stream: Readable, ...buffers: string[][]): void {
  stream.setEncoding('utf-8');
  stream.on('data', (s) => {
    buffers.forEach((buf) => buf.push(s));
  });
}

export class ExecError extends Error {
  constructor(
    message: string,
    public stdout: string,
    public stderr: string,
    public code?: number
  ) {
    super(message);
  }
}

export function rawExec(
  cmd: string,
  opts?: RawExecOptions
): Promise<ExecResult> {
  const stdoutBuf: string[] = [];
  const stderrBuf: string[] = [];

  return new Promise<ExecResult>((resolve, reject) => {
    const child: ChildProcess = spawn(cmd, [], {
      ...opts,
      shell: true,
    });

    pipeStreamToBuffers(child.stdout, stdoutBuf);
    pipeStreamToBuffers(child.stderr, stderrBuf);

    child.on('error', (err: Error) => {
      reject(
        new ExecError(err.message, stdoutBuf.join('\n'), stderrBuf.join('\n'))
      );
    });

    child.on('close', (code: number) => {
      const stdout = stdoutBuf.join('\n');
      const stderr = stderrBuf.join('\n');
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new ExecError(`Process exit code: ${code}`, stdout, stderr, code)
        );
      }
    });
  });
}
