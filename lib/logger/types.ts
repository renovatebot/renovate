import type { Stream } from 'node:stream';
import type { LogLevel, LogLevelString } from 'bunyan';

export type {
  LogLevelString as BunyanLogLevel,
  Serializers as BunyanSerializers,
  Stream as BunyanStream,
} from 'bunyan';

export interface LogError {
  level: LogLevel;
  meta: unknown;
  msg?: string;
}

export interface Logger {
  trace(msg: string): void;
  trace(meta: object, msg?: string): void;
  debug(msg: string): void;
  debug(meta: object, msg?: string): void;
  info(msg: string): void;
  info(meta: object, msg?: string): void;
  warn(msg: string): void;
  warn(meta: object, msg?: string): void;
  error(msg: string): void;
  error(meta: object, msg?: string): void;
  fatal(msg: string): void;
  fatal(meta: object, msg?: string): void;

  once: Logger & {
    reset: () => void;
  };
}

export interface BunyanRecord extends Record<string, unknown> {
  level: number;
  msg: string;
  module?: string;
}

export type BunyanNodeStream = (NodeJS.WritableStream | Stream) & {
  writable?: boolean;
  write: (
    chunk: BunyanRecord | string,
    enc: BufferEncoding,
    cb: (err?: Error | null) => void,
  ) => void;
};

export type BunyanLogger = ReturnType<typeof import('bunyan').createLogger>;

export interface LogLevelRemap {
  matchMessage: string;
  newLogLevel: LogLevelString;
}
