const { logger } = require('../../lib/logger');

describe('logger', () => {
  beforeAll(() => {
    jest.resetModules();
  });
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
});
