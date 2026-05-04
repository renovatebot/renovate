import fs from 'fs-extra';
import pino from 'pino';
import upath from 'upath';
import cmdSerializer from './cmd-serializer.ts';
import configSerializer from './config-serializer.ts';
import errSerializer from './err-serializer.ts';
import { PrettyStdoutStream, formatRecord } from './pretty-stdout.ts';
import type { ProblemStream } from './problem-stream.ts';
import type { LogLevel, LogRecord } from './types.ts';
import { getEnv } from './utils.ts';
import { isString, isUndefined } from '@sindresorhus/is';

// Tracks stream entries for dynamic level management
let stdoutStream: pino.DestinationStream | undefined;
let stdoutEntryId: number | undefined;
let logfileStream: pino.DestinationStream | undefined;
let logfileEntryId: number | undefined;
// Extend pino's types for runtime-only properties missing from the type definitions
interface MultiStreamResWithRemove extends pino.MultiStreamRes {
  remove(id: number): void;
  lastId: number;
}

let multiStream: MultiStreamResWithRemove | undefined;

export function setStreamLevel(
  name: 'stdout' | 'logfile',
  level: LogLevel,
): void {
  if (!multiStream) {
    return;
  }

  if (name === 'stdout' && stdoutEntryId !== undefined && stdoutStream) {
    multiStream.remove(stdoutEntryId);
    multiStream.add({ stream: stdoutStream, level });
    stdoutEntryId = multiStream.lastId;
  } else if (
    name === 'logfile' &&
    logfileEntryId !== undefined &&
    logfileStream
  ) {
    multiStream.remove(logfileEntryId);
    multiStream.add({ stream: logfileStream, level });
    logfileEntryId = multiStream.lastId;
  }
}

export function addStreamEntry(entry: pino.StreamEntry): void {
  multiStream?.add(entry);
}

export function createDefaultStreams(
  stdoutLevel: LogLevel,
  problems: ProblemStream,
  logFile: string | undefined,
): pino.StreamEntry[] {
  stdoutStream =
    getEnv('LOG_FORMAT') === 'json' ? process.stdout : new PrettyStdoutStream();

  const stdoutStreamEntry: pino.StreamEntry = {
    stream: stdoutStream,
    level: stdoutLevel,
  };

  const problemsStreamEntry: pino.StreamEntry = {
    stream: problems,
    level: 'warn' as LogLevel,
  };

  const streams: pino.StreamEntry[] = [stdoutStreamEntry, problemsStreamEntry];

  if (isString(logFile)) {
    const logFileEntry = createLogFileStream(logFile);
    streams.push(logFileEntry);
  }

  return streams;
}

function createLogFileStream(logFile: string): pino.StreamEntry {
  const directoryName = upath.dirname(logFile);
  fs.ensureDirSync(directoryName);
  const logFileLevel = validateLogLevel(getEnv('LOG_FILE_LEVEL'), 'debug');

  // pino.destination with sync:true uses SonicBoom for synchronous writes,
  // avoiding data loss when process.exit() is called before async streams drain.
  if (getEnv('LOG_FILE_FORMAT') === 'pretty') {
    const dest = pino.destination({ dest: logFile, sync: true });
    logfileStream = {
      write: (data: string) => {
        const record = JSON.parse(data) as LogRecord;
        dest.write(formatRecord(record, false));
      },
    };
    return { stream: logfileStream, level: logFileLevel };
  }

  logfileStream = pino.destination({ dest: logFile, sync: true });
  return { stream: logfileStream, level: logFileLevel };
}

export function createLogger(
  stdoutLevel: LogLevel,
  problems: ProblemStream,
): pino.Logger {
  const defaultStreams = createDefaultStreams(
    stdoutLevel,
    problems,
    getEnv('LOG_FILE'),
  );

  multiStream = pino.multistream([], {
    dedupe: false,
  }) as MultiStreamResWithRemove;

  for (const entry of defaultStreams) {
    multiStream.add(entry);
    if (entry.stream === stdoutStream) {
      stdoutEntryId = multiStream.lastId;
    } else if (logfileStream && entry.stream === logfileStream) {
      logfileEntryId = multiStream.lastId;
    }
  }

  return pino(
    {
      level: 'trace', // let multistream handle per-stream filtering
      base: null, // no pid/hostname in output
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
    },
    multiStream,
  );
}

/**
 * Validates a log level string. Returns the level if valid, or the default
 * if undefined. Exits the process with an error if the level is invalid.
 */
export function validateLogLevel(
  logLevelToCheck: string | undefined,
  defaultLevel: LogLevel,
): LogLevel {
  const allowedValues: LogLevel[] = [
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
      allowedValues.includes(logLevelToCheck as LogLevel))
  ) {
    return (logLevelToCheck as LogLevel) ?? defaultLevel;
  }

  const tempLogger = pino({ level: 'fatal', base: null }, process.stdout);
  tempLogger.fatal({ logLevel: logLevelToCheck }, 'Invalid log level');
  process.exit(1);
}
