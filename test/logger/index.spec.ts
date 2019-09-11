import _fs from 'fs-extra';
import {
  logger,
  setMeta,
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

  it('supports log sanitization', () => {
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

  it('supports sanitization', () => {
    expect(() =>
      addStream({
        name: 'logfile',
        path: 'file.log',
        level: 'error',
        type: 'rotating-file',
      })
    ).toThrow("Can't create sanitized stream");

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

    add({
      password: 'coincidence',
    });
    logger.error('coincidence');
    expect(JSON.parse(chunk).msg).not.toEqual('foo');
  });
});
