const { logger } = require('../../lib/logger');

describe('logger', () => {
  it('supports logging with metadata', () => {
    logger.debug({ some: 'meta' }, 'some meta');
  });
  it('supports logging with only metadata', () => {
    logger.debug({ some: 'meta' });
  });
  it('supports logging without metadata', () => {
    logger.debug('some meta');
  });
  it('sets levels', () => {
    logger.levels('stdout', 'DEBUG');
  });
  it('adds stream', () => {
    logger.addStream({
      name: 'logfile',
      path: 'fatal.log',
      level: 'fatal',
    });
  });
});
