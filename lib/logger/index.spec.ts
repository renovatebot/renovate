import type { WriteStream } from 'node:fs';
import fs from 'fs-extra';
import { DateTime } from 'luxon';
import { partial } from '~test/util.ts';
import { add } from '../util/host-rules.ts';
import { addSecretForSanitizing as addSecret } from '../util/sanitize.ts';
import {
  addMeta,
  addStream,
  clearProblems,
  getContext,
  getProblems,
  init,
  levels,
  logLevel,
  logger,
  removeMeta,
  setContext,
  setMeta,
  withMeta,
} from './index.ts';
import { createDefaultStreams } from './pino.ts';
import { ProblemStream } from './problem-stream.ts';
import type { RenovateLogger } from './renovate-logger.ts';

const logContext = 'initial_context';

vi.unmock('./index.ts');
vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'initial_context'),
}));

// Capture stream to intercept logged output for assertions
let capturedLogs: Record<string, any>[] = [];
const captureStream = {
  write(data: string): void {
    capturedLogs.push(JSON.parse(data));
  },
};

// init logger
await init();
addStream({ level: 'trace', stream: captureStream });

describe('logger/index', () => {
  beforeEach(() => {
    capturedLogs = [];
    delete process.env.LOG_FILE_LEVEL;
  });

  it('inits', () => {
    expect(logger).toBeDefined();
  });

  it('uses an auto-generated log context', () => {
    logger.debug('');

    expect(capturedLogs).toHaveLength(1);
    expect(capturedLogs[0]).toMatchObject({ logContext, msg: '' });
  });

  it('sets and gets context', () => {
    const logContext = '123test';
    const msg = 'test';
    setContext(logContext);

    logger.debug(msg);

    expect(getContext()).toBe(logContext);
    expect(capturedLogs).toHaveLength(1);
    expect(capturedLogs[0]).toMatchObject({ logContext, msg });
  });

  it('supports logging with metadata', () => {
    expect(() => logger.debug({ some: 'meta' }, 'some meta')).not.toThrow();
  });

  it('supports logging with only metadata', () => {
    expect(() => logger.debug({ some: 'meta' })).not.toThrow();
  });

  it('supports logging without metadata', () => {
    expect(() => logger.debug('some meta')).not.toThrow();
  });

  describe('meta functions', () => {
    beforeEach(() => {
      setContext(logContext);
      setMeta({});
    });

    it('sets meta', () => {
      setMeta({ foo: 'foo' });
      setMeta({ bar: 'bar' });

      logger.debug({ baz: 'baz' }, 'message');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0]).toMatchObject({
        logContext,
        // `foo` key was rewritten
        bar: 'bar',
        baz: 'baz',
        msg: 'message',
      });
    });

    it('adds meta', () => {
      setMeta({ foo: 'foo' });
      addMeta({ bar: 'bar' });

      logger.debug({ baz: 'baz' }, 'message');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0]).toMatchObject({
        logContext,
        foo: 'foo',
        bar: 'bar',
        baz: 'baz',
        msg: 'message',
      });
    });

    it('removes meta', () => {
      setMeta({
        foo: 'foo',
        bar: 'bar',
      });

      logger.debug({ baz: 'baz' }, 'message');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0]).toMatchObject({
        logContext,
        foo: 'foo',
        bar: 'bar',
        baz: 'baz',
        msg: 'message',
      });

      capturedLogs = [];
      removeMeta(['bar']);

      logger.debug({ baz: 'baz' }, 'message');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0]).toMatchObject({
        logContext,
        foo: 'foo',
        baz: 'baz',
        msg: 'message',
      });
      expect(capturedLogs[0]).not.toHaveProperty('bar');
    });

    it('withMeta adds and removes metadata correctly', () => {
      setMeta({ foo: 'foo' });

      withMeta({ bar: 'bar' }, () => {
        logger.debug({ baz: 'baz' }, 'message');
        expect(capturedLogs).toHaveLength(1);
        expect(capturedLogs[0]).toMatchObject({
          logContext,
          foo: 'foo',
          bar: 'bar',
          baz: 'baz',
          msg: 'message',
        });
      });

      capturedLogs = [];
      logger.debug({ baz: 'baz' }, 'message');
      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0]).toMatchObject({
        logContext,
        foo: 'foo',
        baz: 'baz',
        msg: 'message',
      });
      expect(capturedLogs[0]).not.toHaveProperty('bar');
    });

    it('withMeta handles cleanup when callback throws', () => {
      setMeta({ foo: 'foo' });

      expect(() =>
        withMeta({ bar: 'bar' }, () => {
          logger.debug({ baz: 'baz' }, 'message');
          throw new Error('test error');
        }),
      ).toThrow('test error');

      capturedLogs = [];
      logger.debug({ baz: 'baz' }, 'message');
      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0]).toMatchObject({
        logContext,
        foo: 'foo',
        baz: 'baz',
        msg: 'message',
      });
    });
  });

  describe('createDefaultStreams', () => {
    beforeEach(() => {
      delete process.env.LOG_FILE_FORMAT;
    });

    it('creates log file stream', () => {
      const streams = createDefaultStreams(
        'info',
        new ProblemStream(),
        'file.log',
      );
      expect(streams).toHaveLength(3);
      expect(streams[0]).toMatchObject({ level: 'info' });
      expect(streams[1]).toMatchObject({ level: 'warn' });
      expect(streams[2]).toMatchObject({ level: 'debug' });
    });

    it.each([
      {
        logFileLevel: null,
        expectedLogLevel: 'debug',
      },
      {
        logFileLevel: 'warn',
        expectedLogLevel: 'warn',
      },
    ])(
      'handles log file stream $logFileLevel level',
      ({ logFileLevel, expectedLogLevel }) => {
        if (logFileLevel !== null) {
          process.env.LOG_FILE_LEVEL = logFileLevel?.toString();
        }

        const streams = createDefaultStreams(
          'info',
          new ProblemStream(),
          'file.log',
        );

        const logFileStream = streams[2];

        expect(logFileStream.level).toBe(expectedLogLevel);
      },
    );

    it.each([
      {
        logFileFormat: 'json',
        expectsWrite: (
          stream: { write: (d: string) => void },
          filePath: string,
        ) => {
          stream.write('{"level":30,"msg":"format message"}\n');
          expect(fs.readFileSync(filePath, 'utf8')).toContain('format message');
        },
      },
      {
        logFileFormat: 'pretty',
        expectsWrite: (
          stream: { write: (d: string) => void },
          filePath: string,
        ) => {
          stream.write('{"level":30,"msg":"format message"}\n');
          expect(fs.readFileSync(filePath, 'utf8')).toContain('format message');
        },
      },
    ])(
      'handles log file stream $logFileFormat format',
      ({ logFileFormat, expectsWrite }) => {
        process.env.LOG_FILE_FORMAT = logFileFormat;

        const streams = createDefaultStreams(
          'info',
          new ProblemStream(),
          `${logFileFormat}-format.log`,
        );

        const logFileStream = streams[2];
        expect(logFileStream.stream).toBeDefined();
        expectsWrite(
          logFileStream.stream as { write: (d: string) => void },
          `${logFileFormat}-format.log`,
        );
      },
    );

    it('writes pretty formatted data synchronously to log file', () => {
      process.env.LOG_FILE_FORMAT = 'pretty';

      const streams = createDefaultStreams(
        'info',
        new ProblemStream(),
        'file.log',
      );

      const logFileStream = streams[2];
      const stream = logFileStream.stream as {
        write: (...args: unknown[]) => void;
      };

      stream.write('{"level":30,"msg":"test message"}\n');

      expect(fs.readFileSync('file.log', 'utf8')).toContain('test message');
    });

    it('writes json data synchronously to log file', () => {
      const streams = createDefaultStreams(
        'info',
        new ProblemStream(),
        'file.log',
      );

      const logFileStream = streams[2];
      const stream = logFileStream.stream as {
        write: (...args: unknown[]) => void;
      };

      stream.write('{"level":30,"msg":"json message"}\n');

      expect(fs.readFileSync('file.log', 'utf8')).toContain('json message');
    });
  });

  it('sets level', () => {
    expect(logLevel()).toBeDefined(); // depends on passed env
    expect(() => levels('stdout', 'debug')).not.toThrow();
    expect(logLevel()).toBe('debug');
  });

  it('should create a child logger', () => {
    const childLogger = (logger as RenovateLogger).childLogger();
    const loggerSpy = vi.spyOn(logger, 'debug');
    const childLoggerSpy = vi.spyOn(childLogger, 'debug');

    childLogger.debug('test');

    expect(loggerSpy).toHaveBeenCalledTimes(0);
    expect(childLoggerSpy).toHaveBeenCalledTimes(1);
    expect(childLoggerSpy).toHaveBeenCalledExactlyOnceWith('test');
  });

  it('saves problems', () => {
    addSecret('p4$$w0rd');
    levels('stdout', 'fatal');
    logger.fatal('fatal error');
    logger.error('some meta');
    logger.error({ some: 'meta', password: 'super secret' });
    logger.error({ some: 'meta' }, 'message');
    logger.warn('a warning with a p4$$w0rd');
    logger.trace('ignored');
    logger.info('ignored');
    expect(getProblems()).toMatchObject([
      { msg: 'fatal error' },
      { msg: 'some meta' },
      { some: 'meta', password: '***********' },
      { some: 'meta', msg: 'message' },
      { msg: 'a warning with a **redacted**' },
    ]);
    clearProblems();
    expect(getProblems()).toHaveLength(0);
  });

  it('should contain path or stream parameters', () => {
    expect(() =>
      addStream({
        name: 'logfile',
        level: 'error',
      }),
    ).toThrow("Missing 'stream' or 'path' for log stream");
  });

  it("doesn't support rotating files", () => {
    expect(() =>
      addStream({
        name: 'logfile',
        path: 'file.log',
        level: 'error',
        type: 'rotating-file',
      }),
    ).toThrow("Rotating files aren't supported");
  });

  it('supports file-based logging', () => {
    let chunk = '';
    vi.spyOn(fs, 'createWriteStream').mockReturnValueOnce(
      partial<WriteStream>({
        writable: true,
        write(x: string): boolean {
          chunk = x;
          return true;
        },
      }),
    );

    addStream({
      name: 'logfile',
      path: 'file.log',
      level: 'error',
    });

    logger.error('foo');

    expect(JSON.parse(chunk).msg).toBe('foo');
  });

  it('handles cycles', () => {
    let logged: Record<string, any> = {};
    vi.spyOn(fs, 'createWriteStream').mockReturnValueOnce(
      partial<WriteStream>({
        writable: true,
        write(x: string): boolean {
          logged = JSON.parse(x);
          return true;
        },
      }),
    );

    addStream({
      name: 'logfile',
      path: 'file.log',
      level: 'error',
    });

    const meta: Record<string, any> = { foo: null, bar: [] };
    meta.foo = meta;
    meta.bar.push(meta);
    logger.error(meta, 'foo');
    expect(logged.msg).toBe('foo');
    expect(logged.foo.foo).toBe('[Circular]');
    expect(logged.foo.bar).toEqual(['[Circular]']);
    expect(logged.bar).toEqual([
      {
        bar: '[Circular]',
        foo: '[Circular]',
      },
    ]);
  });

  it('sanitizes secrets', () => {
    let logged: Record<string, any> = {};
    vi.spyOn(fs, 'createWriteStream').mockReturnValueOnce(
      partial<WriteStream>({
        writable: true,
        write(x: string): boolean {
          logged = JSON.parse(x);
          return true;
        },
      }),
    );

    addStream({
      name: 'logfile',
      path: 'file.log',
      level: 'error',
    });
    add({ password: 'secret"password' });

    class SomeClass {
      public field: string;
      constructor(field: string) {
        this.field = field;
      }
    }

    const prBody = 'test';
    logger.error({
      foo: 'secret"password',
      bar: ['somethingelse', 'secret"password'],
      npmToken: 'token',
      buffer: Buffer.from('test'),
      content: 'test',
      prBody,
      secrets: {
        foo: 'barsecret',
      },
      someFn: () => 'secret"password',
      someObject: new SomeClass('secret"password'),
    });

    expect(logged.foo).not.toBe('secret"password');
    expect(logged.bar[0]).toBe('somethingelse');
    expect(logged.foo).toContain('redacted');
    expect(logged.bar[1]).toContain('redacted');
    expect(logged.npmToken).not.toBe('token');
    expect(logged.buffer).toBe('[content]');
    expect(logged.content).toBe('[content]');
    expect(logged.prBody).toBe(prBody);
    expect(logged.secrets.foo).toBe('***********');
    expect(logged.someFn).toBe('[function]');
    expect(logged.someObject.field).toBe('**redacted**');
  });

  it('applies custom serializer while keeping default sanitizers', () => {
    let logged: Record<string, any> = {};
    vi.spyOn(fs, 'createWriteStream').mockReturnValueOnce(
      partial<WriteStream>({
        writable: true,
        write(x: string): boolean {
          logged = JSON.parse(x);
          return true;
        },
      }),
    );

    addStream({
      name: 'logfile',
      path: 'file.log',
      level: 'error',
    });
    add({ password: 'secret"password' });

    class SomeClass {
      public field: string;
      constructor(field: string) {
        this.field = field;
      }
    }

    const childLogger = (logger as RenovateLogger).childLogger();
    childLogger.addSerializers({
      baz: (baz: string): any => {
        return 'baz custom serializer: ' + baz;
      },
    });

    const prBody = 'test';
    childLogger.error({
      foo: 'secret"password',
      bar: ['somethingelse', 'secret"password'],
      baz: 'baz',
      npmToken: 'token',
      buffer: Buffer.from('test'),
      content: 'test',
      prBody,
      secrets: {
        foo: 'barsecret',
      },
      someDate: new Date('2021-04-05T06:07Z'),
      someFn: () => 'secret"password',
      someLuxonDate: DateTime.fromISO('2020-02-29'),
      someLuxonDateTime: DateTime.fromISO('2020-02-29T01:40:21.345+00:00'),
      someObject: new SomeClass('secret"password'),
    });

    expect(logged.baz).toContain('baz custom serializer: baz');

    expect(logged.foo).not.toBe('secret"password');
    expect(logged.bar[0]).toBe('somethingelse');
    expect(logged.foo).toContain('redacted');
    expect(logged.bar[1]).toContain('redacted');
    expect(logged.npmToken).not.toBe('token');
    expect(logged.buffer).toBe('[content]');
    expect(logged.content).toBe('[content]');
    expect(logged.prBody).toBe(prBody);
    expect(logged.secrets.foo).toBe('***********');
    expect(logged.someDate).toBe('2021-04-05T06:07:00.000Z');
    expect(logged.someFn).toBe('[function]');
    expect(logged.someLuxonDate).toBe('2020-02-29T00:00:00.000+00:00');
    expect(logged.someLuxonDateTime).toBe('2020-02-29T01:40:21.345+00:00');
    expect(logged.someObject.field).toBe('**redacted**');
  });

  it('sanitizes secrets in object keys', () => {
    let logged: Record<string, any> = {};
    vi.spyOn(fs, 'createWriteStream').mockReturnValueOnce(
      partial<WriteStream>({
        writable: true,
        write(x: string): boolean {
          logged = JSON.parse(x);
          return true;
        },
      }),
    );

    addStream({
      name: 'logfile',
      path: 'file.log',
      level: 'debug',
    });

    const secret = 'https://secret@example.com';
    const data: Record<string, any> = {
      [secret]: { nested: secret },
    };

    logger.debug(
      {
        data,
        secret,
      },
      'logs secrets in keys',
    );

    expect(logged.data).toStrictEqual({
      'https://**redacted**@example.com': {
        nested: 'https://**redacted**@example.com',
      },
    });
    expect(logged.secret).toBe('https://**redacted**@example.com');
  });
});
