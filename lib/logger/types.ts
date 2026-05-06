import type pino from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// Same values as pino
export const TRACE = 10;
export const DEBUG = 20;
export const INFO = 30;
export const WARN = 40;
export const ERROR = 50;
export const FATAL = 60;

export const nameFromLevel: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

export interface LogError {
  level: number;
  meta: any;
  msg?: string;
}

export interface Logger {
  trace(msg: string): void;
  trace(meta: Record<string, any>, msg?: string): void;
  debug(msg: string): void;
  debug(meta: Record<string, any>, msg?: string): void;
  info(msg: string): void;
  info(meta: Record<string, any>, msg?: string): void;
  warn(msg: string): void;
  warn(meta: Record<string, any>, msg?: string): void;
  error(msg: string): void;
  error(meta: Record<string, any>, msg?: string): void;
  fatal(msg: string): void;
  fatal(meta: Record<string, any>, msg?: string): void;

  once: Logger & {
    reset: () => void;
  };
}

export interface LogRecord extends Record<string, any> {
  level: number;
  msg: string;
  module?: string;
}

export interface LogStream {
  level: LogLevel;
  stream?: { write(msg: string): void };
  path?: string;
  name?: string;
  type?: string;
}

export type PinoLogger = pino.Logger;

export interface LogLevelRemap {
  matchMessage: string;
  newLogLevel: LogLevel;
}
