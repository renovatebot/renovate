const { initLogger } = require('../../lib/logger');

describe('logger', () => {
  it('inits', () => {
    delete global.logger;
    delete process.env.LOG_LEVEL;
    initLogger();
    expect(global.logger).toBeDefined();
  });
  it('supports logging with metadata', () => {
    global.logger.debug({ some: 'meta' }, 'some meta');
  });
  it('supports logging with only metadata', () => {
    global.logger.debug({ some: 'meta' });
  });
  it('supports logging without metadata', () => {
    global.logger.debug('some meta');
  });
  it('sets levels', () => {
    global.logger.levels('stdout', 'DEBUG');
  });
  it('sets meta', () => {
    global.logger.setMeta({ some: 'meta', and: 'more' });
  });
  it('adds stream', () => {
    global.logger.addStream({
      name: 'logfile',
      path: 'fatal.log',
      level: 'fatal',
    });
  });
});
