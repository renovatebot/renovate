import type { WriteStream } from 'node:fs';
import fs from 'fs-extra';
import { partial } from '../../test/util';
import { add } from '../util/host-rules';
import { addSecretForSanitizing as addSecret } from '../util/sanitize';
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
    expect(getProblems()).toMatchObject([
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
    jest.spyOn(fs, 'createWriteStream').mockReturnValueOnce(
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
    jest.spyOn(fs, 'createWriteStream').mockReturnValueOnce(
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
    jest.spyOn(fs, 'createWriteStream').mockReturnValueOnce(
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
