import fs from 'fs-extra';
import {
  logger,
  setContext,
  getContext,
  setMeta,
  addMeta,
  removeMeta,
  levels,
  getErrors,
  addStream,
} from '.';
import { add } from '../util/host-rules';

jest.unmock('.');

const logFile = 'file.log';

describe('logger', () => {
  beforeEach(async () => {
    try {
      await fs.unlink(logFile);
    } catch {
      // File doesn't exist
    }
  });
  it('inits', () => {
    expect(logger).toBeDefined();
  });
  it('sets and gets context', () => {
    setContext('abc123');
    expect(getContext()).toEqual('abc123');
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
        path: logFile,
        level: 'error',
        type: 'rotating-file',
      })
    ).toThrow("Rotating files aren't supported");
  });

  it('supports file-based logging', async () => {
    addStream({
      name: 'logfile',
      path: logFile,
      level: 'error',
    });

    logger.error('foo');

    const content = await fs.readFile(logFile, 'utf-8');
    expect(JSON.parse(content).msg).toEqual('foo');
  });

  it('handles cycles', async () => {
    addStream({
      name: 'logfile',
      path: logFile,
      level: 'error',
    });

    const meta = { foo: null, bar: [] };
    meta.foo = meta;
    meta.bar.push(meta);
    logger.error(meta, 'foo');

    const logged = JSON.parse(await fs.readFile(logFile, 'utf-8'));
    expect(logged.msg).toEqual('foo');
    expect(logged.foo.foo).toEqual('[Circular]');
    expect(logged.foo.bar).toEqual(['[Circular]']);
    expect(logged.bar).toEqual('[Circular]');
  });

  it('sanitizes secrets', async () => {
    addStream({
      name: 'logfile',
      path: logFile,
      level: 'error',
    });
    add({ password: 'secret"password' });

    logger.error({
      foo: 'secret"password',
      bar: ['somethingelse', 'secret"password'],
    });

    const logged = JSON.parse(await fs.readFile(logFile, 'utf-8'));

    expect(logged.foo).not.toEqual('secret"password');
    expect(logged.bar[0]).toEqual('somethingelse');
    expect(logged.foo).toContain('redacted');
    expect(logged.bar[1]).toContain('redacted');
  });
});
