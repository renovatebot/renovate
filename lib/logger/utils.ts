import { Stream } from 'stream';
import is from '@sindresorhus/is';
import bunyan from 'bunyan';
import fs from 'fs-extra';
import { clone } from '../util/clone';
import { HttpError } from '../util/http';
import { redactedFields, sanitize } from '../util/sanitize';
import type { BunyanRecord, BunyanStream } from './types';

const excludeProps = ['pid', 'time', 'v', 'hostname'];

export class ProblemStream extends Stream {
  private _problems: BunyanRecord[] = [];

  readable: boolean;

  writable: boolean;

  constructor() {
    super();
    this.readable = false;
    this.writable = true;
  }

  write(data: BunyanRecord): boolean {
    const problem = { ...data };
    for (const prop of excludeProps) {
      delete problem[prop];
    }
    this._problems.push(problem);
    return true;
  }

  getProblems(): BunyanRecord[] {
    return this._problems;
  }

  clearProblems(): void {
    this._problems = [];
  }
}
const templateFields = ['prBody'];
const contentFields = [
  'content',
  'contents',
  'packageLockParsed',
  'yarnLockParsed',
];

export default function prepareError(err: Error): Record<string, unknown> {
  const response: Record<string, unknown> = {
    ...err,
  };

  // Required as message is non-enumerable
  if (!response.message && err.message) {
    response.message = err.message;
  }

  // Required as stack is non-enumerable
  if (!response.stack && err.stack) {
    response.stack = err.stack;
  }

  // handle got error
  if (err instanceof HttpError) {
    const options: Record<string, unknown> = {
      headers: clone(err.options.headers),
      url: err.options.url?.toString(),
      hostType: err.options.context.hostType,
    };
    response.options = options;

    options.username = err.options.username;
    options.password = err.options.password;
    options.method = err.options.method;
    options.http2 = err.options.http2;

    // istanbul ignore else
    if (err.response) {
      response.response = {
        statusCode: err.response?.statusCode,
        statusMessage: err.response?.statusMessage,
        body:
          err.name === 'TimeoutError' ? undefined : clone(err.response.body),
        headers: clone(err.response.headers),
        httpVersion: err.response.httpVersion,
      };
    }
  }

  return response;
}

type NestedValue = unknown[] | object;

function isNested(value: unknown): value is NestedValue {
  return is.array(value) || is.object(value);
}

export function sanitizeValue(
  value: unknown,
  seen = new WeakMap<NestedValue, unknown>()
): any {
  if (is.string(value)) {
    return sanitize(value);
  }

  if (is.date(value)) {
    return value;
  }

  if (is.function_(value)) {
    return '[function]';
  }

  if (is.buffer(value)) {
    return '[content]';
  }

  if (is.error(value)) {
    const err = prepareError(value);
    return sanitizeValue(err, seen);
  }

  if (is.array(value)) {
    const length = value.length;
    const arrayResult = Array(length);
    seen.set(value, arrayResult);
    for (let idx = 0; idx < length; idx += 1) {
      const val = value[idx];
      arrayResult[idx] =
        isNested(val) && seen.has(val)
          ? seen.get(val)
          : sanitizeValue(val, seen);
    }
    return arrayResult;
  }

  if (is.object(value)) {
    const objectResult: Record<string, any> = {};
    seen.set(value, objectResult);
    for (const [key, val] of Object.entries<any>(value)) {
      let curValue: any;
      if (!val) {
        curValue = val;
      } else if (redactedFields.includes(key)) {
        curValue = '***********';
      } else if (contentFields.includes(key)) {
        curValue = '[content]';
      } else if (templateFields.includes(key)) {
        curValue = '[Template]';
      } else if (key === 'secrets') {
        curValue = {};
        Object.keys(val).forEach((secretKey) => {
          curValue[secretKey] = '***********';
        });
      } else {
        curValue = seen.has(val) ? seen.get(val) : sanitizeValue(val, seen);
      }

      objectResult[key] = curValue;
    }

    return objectResult;
  }

  return value;
}

export function withSanitizer(streamConfig: bunyan.Stream): bunyan.Stream {
  if (streamConfig.type === 'rotating-file') {
    throw new Error("Rotating files aren't supported");
  }

  const stream = streamConfig.stream as BunyanStream;
  if (stream?.writable) {
    const write = (
      chunk: BunyanRecord,
      enc: BufferEncoding,
      cb: (err?: Error | null) => void
    ): void => {
      const raw = sanitizeValue(chunk);
      const result =
        streamConfig.type === 'raw'
          ? raw
          : JSON.stringify(raw, bunyan.safeCycles()).replace(/\n?$/, '\n'); // TODO #12874
      stream.write(result, enc, cb);
    };

    return {
      ...streamConfig,
      type: 'raw',
      stream: { write },
    } as bunyan.Stream;
  }

  if (streamConfig.path) {
    const fileStream = fs.createWriteStream(streamConfig.path, {
      flags: 'a',
      encoding: 'utf8',
    });

    return withSanitizer({ ...streamConfig, stream: fileStream });
  }

  throw new Error("Missing 'stream' or 'path' for bunyan stream");
}

/**
 * A function that terminates exeution if the log level that was entered is
 *  not a valid value for the Bunyan logger.
 * @param logLevelToCheck
 * @returns returns undefined when the logLevelToCheck is valid. Else it stops execution.
 */
export function validateLogLevel(logLevelToCheck: string | undefined): void {
  const allowedValues: bunyan.LogLevel[] = [
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
  ];
  if (
    is.undefined(logLevelToCheck) ||
    (is.string(logLevelToCheck) &&
      allowedValues.includes(logLevelToCheck as bunyan.LogLevel))
  ) {
    // log level is in the allowed values or its undefined
    return;
  }

  const logger = bunyan.createLogger({
    name: 'renovate',
    streams: [
      {
        level: 'fatal',
        stream: process.stdout,
      },
    ],
  });
  logger.fatal(`${logLevelToCheck} is not a valid log level. terminating...`);
  process.exit(1);
}
