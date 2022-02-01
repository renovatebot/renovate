import bunyan from 'bunyan';
import _fs from 'fs-extra';
import { add } from '../util/host-rules';
import { add as addSecret } from '../util/sanitize';
import { isValidLogLevel } from './utils';
import {
  addMeta,
  addStream,
  clearProblems,
  getContext,
  getProblems,
  levels,
  logger,
  removeMeta,
  setContext,
  setMeta,
} from '.';

jest.unmock('.');

jest.mock('fs-extra');
const fs: any = _fs;

describe('logger/index', () => {
  it('inits', () => {
    expect(logger).toBeDefined();
  });
  it('sets and gets context', () => {
    setContext('123test');
    expect(getContext()).toBe('123test');
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

  it('sets meta', () => {
    expect(() => setMeta({ any: 'test' })).not.toThrow();
  });

  it('adds meta', () => {
    expect(() => addMeta({ new: 'test' })).not.toThrow();
  });

  it('removes meta', () => {
    expect(() => removeMeta(['new'])).not.toThrow();
  });

  it('sets level', () => {
    expect(() => levels('stdout', 'debug')).not.toThrow();
  });

  it('saves problems', () => {
    addSecret('p4$$w0rd');
    levels('stdout', 'fatal');
    logger.error('some meta');
    logger.error({ some: 'meta', password: 'super secret' });
    logger.error({ some: 'meta' }, 'message');
    logger.warn('a warning with a p4$$w0rd');
    logger.info('ignored');
    expect(getProblems()).toMatchSnapshot([
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
      })
    ).toThrow("Missing 'stream' or 'path' for bunyan stream");
  });

  it("doesn't support rotating files", () => {
    expect(() =>
      addStream({
        name: 'logfile',
        path: 'file.log',
        level: 'error',
        type: 'rotating-file',
      })
    ).toThrow("Rotating files aren't supported");
  });

  it('supports file-based logging', () => {
    let chunk = '';
    fs.createWriteStream.mockReturnValueOnce({
      writable: true,
      write(x: string) {
        chunk = x;
      },
    });

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
    fs.createWriteStream.mockReturnValueOnce({
      writable: true,
      write(x: string) {
        logged = JSON.parse(x);
      },
    });

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
    fs.createWriteStream.mockReturnValueOnce({
      writable: true,
      write(x: string) {
        logged = JSON.parse(x);
      },
    });

    addStream({
      name: 'logfile',
      path: 'file.log',
      level: 'error',
    });
    add({ password: 'secret"password' });

    class SomeClass {
      constructor(public field: string) {}
    }

    logger.error({
      foo: 'secret"password',
      bar: ['somethingelse', 'secret"password'],
      npmToken: 'token',
      buffer: Buffer.from('test'),
      content: 'test',
      prBody: 'test',
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
    expect(logged.prBody).toBe('[Template]');
    expect(logged.secrets.foo).toBe('***********');
    expect(logged.someFn).toBe('[function]');
    expect(logged.someObject.field).toBe('**redacted**');
  });

  it('checks for valid log level', () => {
    expect(isValidLogLevel('warning' as bunyan.LogLevel)).toBeFalsy();
    expect(isValidLogLevel('warn' as bunyan.LogLevel)).toBeTruthy();
    expect(isValidLogLevel('trace' as bunyan.LogLevel)).toBeTruthy();
    expect(isValidLogLevel(' ' as bunyan.LogLevel)).toBeTruthy();
    expect(isValidLogLevel('' as bunyan.LogLevel)).toBeTruthy();
    expect(isValidLogLevel(20 as bunyan.LogLevel)).toBeTruthy();
    expect(isValidLogLevel(10 as bunyan.LogLevel)).toBeTruthy();
    expect(isValidLogLevel(100 as bunyan.LogLevel)).toBeFalsy();
  });
});
