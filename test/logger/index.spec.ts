import _fs from 'fs-extra';
import {
  logger,
  setMeta,
  addMeta,
  removeMeta,
  levels,
  getErrors,
  addStream,
} from '../../lib/logger';
import { add } from '../../lib/util/host-rules';

jest.unmock('../../lib/logger');

jest.mock('fs-extra');
const fs: any = _fs;

describe('logger', () => {
  it('inits', () => {
    expect(logger).toBeDefined();
  });
  it('supports logging with metadata', () => {
    logger.debug({ some: 'meta' }, 'some meta');
  });
  it('supports logging with only metadata', () => {
    logger.debug({ some: 'meta' });
  });
  it('supports logging without metadata', () => {
    logger.debug('some meta');
  });

  it('sets meta', () => {
    setMeta({ any: 'test' });
  });

  it('adds meta', () => {
    addMeta({ new: 'test' });
  });

  it('removes meta', () => {
    removeMeta(['new']);
  });

  it('sets level', () => {
    levels('stdout', 'debug');
  });

  it('saves errors', () => {
    levels('stdout', 'fatal');
    logger.error('some meta');
    logger.error({ some: 'meta' });
    logger.error({ some: 'meta' }, 'message');
    expect(getErrors()).toMatchSnapshot();
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
    });

    expect(logged.foo).not.toEqual('secret"password');
    expect(logged.bar[0]).toEqual('somethingelse');
    expect(logged.foo).toContain('redacted');
    expect(logged.bar[1]).toContain('redacted');
  });
});
