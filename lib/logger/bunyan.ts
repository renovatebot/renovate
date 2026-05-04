import { isString, isUndefined } from '@sindresorhus/is';
import fs from 'fs-extra';
import upath from 'upath';
import { bunyan } from '../expose.ts';
import cmdSerializer from './cmd-serializer.ts';
import configSerializer from './config-serializer.ts';
import errSerializer from './err-serializer.ts';
import { PrettyStdoutStream, formatRecord } from './pretty-stdout.ts';
import type { ProblemStream } from './problem-stream.ts';
import type {
  BunyanLogLevel,
  BunyanLogger,
  BunyanRecord,
  BunyanStream,
} from './types.ts';
import { getEnv } from './utils.ts';
import { withSanitizer } from './with-sanitizer.ts';

export function createDefaultStreams(
  stdoutLevel: BunyanLogLevel,
  problems: ProblemStream,
  logFile: string | undefined,
): BunyanStream[] {
  const stdout: BunyanStream = {
    name: 'stdout',
    level: stdoutLevel,
    stream: process.stdout,
  };

  // v8 ignore else -- TODO: add test #40625
  if (getEnv('LOG_FORMAT') !== 'json') {
    const prettyStdOut = new PrettyStdoutStream();
    stdout.stream = prettyStdOut;
    stdout.type = 'raw';
  }

  const problemsStream: BunyanStream = {
    name: 'problems',
    level: 'warn' as BunyanLogLevel,
    stream: problems as any,
    type: 'raw',
  };

  const logFileStream: BunyanStream | undefined = isString(logFile)
    ? createLogFileStream(logFile)
    : undefined;

  return [stdout, problemsStream, logFileStream].filter(
    Boolean,
  ) as BunyanStream[];
}

function createLogFileStream(logFile: string): BunyanStream {
  // Ensure log file directory exists
  const directoryName = upath.dirname(logFile);
  fs.ensureDirSync(directoryName);

  const logFileLevel = validateLogLevel(getEnv('LOG_FILE_LEVEL'), 'debug');

  // Sync writes avoid data loss when process.exit() is called before async streams drain.
  const fd = fs.openSync(logFile, 'a');

  if (getEnv('LOG_FILE_FORMAT') === 'pretty') {
    return {
      name: 'logfile',
      level: logFileLevel,
      type: 'raw',
      stream: {
        writable: true,
        write: (rec: unknown) => {
          fs.writeSync(fd, formatRecord(rec as BunyanRecord, false));
        },
      },
    } as BunyanStream;
  }

  return {
    name: 'logfile',
    level: logFileLevel,
    stream: {
      writable: true,
      write: (data: string) => {
        fs.writeSync(fd, data);
      },
    },
  } as BunyanStream;
}

function serializedSanitizedLogger(streams: BunyanStream[]): BunyanLogger {
  return bunyan().createLogger({
    name: 'renovate',
    serializers: {
      body: configSerializer,
      cmd: cmdSerializer,
      config: configSerializer,
      migratedConfig: configSerializer,
      originalConfig: configSerializer,
      presetConfig: configSerializer,
      oldConfig: configSerializer,
      newConfig: configSerializer,
      err: errSerializer,
    },
    streams: streams.map(withSanitizer),
  });
}

export function createLogger(
  stdoutLevel: BunyanLogLevel,
  problems: ProblemStream,
): BunyanLogger {
  const defaultStreams = createDefaultStreams(
    stdoutLevel,
    problems,
    getEnv('LOG_FILE'),
  );

  return serializedSanitizedLogger(defaultStreams);
}
/**
 * A function that terminates execution if the log level that was entered is
 *  not a valid value for the Bunyan logger.
 * @param logLevelToCheck
 * @returns returns the logLevel when the logLevelToCheck is valid or the defaultLevel passed as argument when it is undefined. Else it stops execution.
 */
export function validateLogLevel(
  logLevelToCheck: string | undefined,
  defaultLevel: BunyanLogLevel,
): BunyanLogLevel {
  const allowedValues: BunyanLogLevel[] = [
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
  ];

  if (
    isUndefined(logLevelToCheck) ||
    (isString(logLevelToCheck) &&
      allowedValues.includes(logLevelToCheck as BunyanLogLevel))
  ) {
    // log level is in the allowed values or its undefined
    return (logLevelToCheck as BunyanLogLevel) ?? defaultLevel;
  }

  const logger = bunyan().createLogger({
    name: 'renovate',
    streams: [
      {
        level: 'fatal',
        stream: process.stdout,
      },
    ],
  });
  logger.fatal({ logLevel: logLevelToCheck }, 'Invalid log level');
  process.exit(1);
}
