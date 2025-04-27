import type { WriteStream } from 'node:fs';
import bunyan from 'bunyan';
import fs from 'fs-extra';
import { add } from '../util/host-rules';
import { addSecretForSanitizing as addSecret } from '../util/sanitize';
import type { RenovateLogger } from './renovate-logger';
import { ProblemStream } from './utils';
import {
  addMeta,
  addStream,
  clearProblems,
  createDefaultStreams,
  getContext,
  getProblems,
  levels,
  logLevel,
  logger,
  removeMeta,
  setContext,
  setMeta,
  withMeta,
} from '.';
import { partial } from '~test/util';

const logContext = 'initial_context';

vi.unmock('.');
vi.mock('nanoid', () => ({
  nanoid: () => 'initial_context',
}));

const bunyanDebugSpy = vi.spyOn(bunyan.prototype, 'debug');

describe('logger/index', () => {
  it('inits', () => {
    expect(logger).toBeDefined();
  });

  it('uses an auto-generated log context', () => {
    logger.debug('');

    expect(bunyanDebugSpy).toHaveBeenCalledWith({ logContext }, '');
  });

  it('sets and gets context', () => {
    const logContext = '123test';
    const msg = 'test';
    setContext(logContext);

    logger.debug(msg);

    expect(getContext()).toBe(logContext);
    expect(bunyanDebugSpy).toHaveBeenCalledWith({ logContext }, msg);
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

      expect(bunyanDebugSpy).toHaveBeenCalledWith(
        {
          logContext,
          // `foo` key was rewritten
          bar: 'bar',
          baz: 'baz',
        },
        'message',
      );
      expect(bunyanDebugSpy).toHaveBeenCalledTimes(1);
    });

    it('adds meta', () => {
      setMeta({ foo: 'foo' });
      addMeta({ bar: 'bar' });

      logger.debug({ baz: 'baz' }, 'message');

      expect(bunyanDebugSpy).toHaveBeenCalledWith(
        {
          logContext,
          foo: 'foo',
          bar: 'bar',
          baz: 'baz',
        },
        'message',
      );
      expect(bunyanDebugSpy).toHaveBeenCalledTimes(1);
    });

    it('removes meta', () => {
      setMeta({
        foo: 'foo',
        bar: 'bar',
      });

      logger.debug({ baz: 'baz' }, 'message');

      expect(bunyanDebugSpy).toHaveBeenCalledWith(
        {
          logContext,
          foo: 'foo',
          bar: 'bar',
          baz: 'baz',
        },
        'message',
      );
      expect(bunyanDebugSpy).toHaveBeenCalledTimes(1);

      removeMeta(['bar']);

      logger.debug({ baz: 'baz' }, 'message');

      expect(bunyanDebugSpy).toHaveBeenCalledWith(
        {
          logContext,
          foo: 'foo',
          baz: 'baz',
        },
        'message',
      );
      expect(bunyanDebugSpy).toHaveBeenCalledTimes(2);
    });

    it('withMeta adds and removes metadata correctly', () => {
      setMeta({ foo: 'foo' });

      withMeta({ bar: 'bar' }, () => {
        logger.debug({ baz: 'baz' }, 'message');
        expect(bunyanDebugSpy).toHaveBeenCalledWith(
          {
            logContext,
            foo: 'foo',
            bar: 'bar',
            baz: 'baz',
          },
          'message',
        );
      });

      logger.debug({ baz: 'baz' }, 'message');
      expect(bunyanDebugSpy).toHaveBeenCalledWith(
        {
          logContext,
          foo: 'foo',
          bar: 'bar',
          baz: 'baz',
        },
        'message',
      );
    });

    it('withMeta handles cleanup when callback throws', () => {
      setMeta({ foo: 'foo' });

      expect(() =>
        withMeta({ bar: 'bar' }, () => {
          logger.debug({ baz: 'baz' }, 'message');
          throw new Error('test error');
        }),
      ).toThrow('test error');

      logger.debug({ baz: 'baz' }, 'message');
      expect(bunyanDebugSpy).toHaveBeenCalledWith(
        {
          logContext,
          foo: 'foo',
          bar: 'bar',
          baz: 'baz',
        },
        'message',
      );
    });
  });

  describe('createDefaultStreams', () => {
    it('creates log file stream', () => {
      expect(
        createDefaultStreams('info', new ProblemStream(), 'file.log'),
      ).toMatchObject([
        { name: 'stdout', type: 'raw' },
        { name: 'problems', type: 'raw' },
        { name: 'logfile' },
      ]);
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
    expect(childLoggerSpy).toHaveBeenCalledWith('test');
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
    ).toThrow("Missing 'stream' or 'path' for bunyan stream");
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
    expect(logged.bar).toBe('[Circular]');
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
      constructor(public field: string) {}
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
});
