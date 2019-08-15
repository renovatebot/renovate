import { logger, setMeta, levels, getErrors } from '../../lib/logger';

jest.unmock('../../lib/logger');

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
});
