import _fs from 'fs-extra';
import { add } from '../util/host-rules';
import { add as addSecret } from '../util/sanitize';
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

describe('logger', () => {
  it('inits', () => {
    expect(logger).toBeDefined();
  });
  it('sets and gets context', () => {
    setContext('abc123');
    expect(getContext()).toEqual('abc123');
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
    expect(getProblems()).toMatchSnapshot();
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
    let chunk = null;
    fs.createWriteStream.mockReturnValueOnce({
      writable: true,
      write(x) {
        chunk = x;
      },
    });

    addStream({
      name: 'logfile',
      path: 'file.log',
      level: 'error',
    });

    logger.error('foo');

    expect(JSON.parse(chunk).msg).toEqual('foo');
  });

  it('handles cycles', () => {
    let logged = null;
    fs.createWriteStream.mockReturnValueOnce({
      writable: true,
      write(x) {
        logged = JSON.parse(x);
      },
    });

    addStream({
      name: 'logfile',
      path: 'file.log',
      level: 'error',
    });

    const meta = { foo: null, bar: [] };
    meta.foo = meta;
    meta.bar.push(meta);
    logger.error(meta, 'foo');
    expect(logged.msg).toEqual('foo');
    expect(logged.foo.foo).toEqual('[Circular]');
    expect(logged.foo.bar).toEqual(['[Circular]']);
    expect(logged.bar).toEqual('[Circular]');
  });

  it('sanitizes secrets', () => {
    let logged = null;
    fs.createWriteStream.mockReturnValueOnce({
      writable: true,
      write(x) {
        logged = JSON.parse(x);
      },
    });

    addStream({
      name: 'logfile',
      path: 'file.log',
      level: 'error',
    });
    add({ password: 'secret"password' });

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
    });

    expect(logged.foo).not.toEqual('secret"password');
    expect(logged.bar[0]).toEqual('somethingelse');
    expect(logged.foo).toContain('redacted');
    expect(logged.bar[1]).toContain('redacted');
    expect(logged.npmToken).not.toEqual('token');
    expect(logged.buffer).toEqual('[content]');
    expect(logged.content).toEqual('[content]');
    expect(logged.prBody).toEqual('[Template]');
    expect(logged.secrets.foo).toEqual('***********');
  });
});
