import { once, reset } from './once';
import { logger } from '.';

jest.unmock('.');

describe('logger/once', () => {
  afterEach(() => {
    reset();
  });

  describe('core', () => {
    it('should call a function only once', () => {
      const innerFn = jest.fn();

      function outerFn() {
        once(innerFn);
      }

      outerFn();
      outerFn();
      outerFn();
      expect(innerFn).toHaveBeenCalledTimes(1);
    });

    it('supports support distinct calls', () => {
      const innerFn1 = jest.fn();
      const innerFn2 = jest.fn();

      function outerFn() {
        once(innerFn1);
        once(innerFn2);
      }

      outerFn();
      outerFn();
      outerFn();
      expect(innerFn1).toHaveBeenCalledTimes(1);
      expect(innerFn2).toHaveBeenCalledTimes(1);
    });

    it('resets keys', () => {
      const innerFn = jest.fn();

      function outerFn() {
        once(innerFn);
      }

      outerFn();
      reset();
      outerFn();

      expect(innerFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('logger', () => {
    it('logs once per function call', () => {
      const debug = jest.spyOn(logger, 'debug');

      function doSomething() {
        logger.once.debug('test');
      }

      doSomething();
      doSomething();
      doSomething();
      expect(debug).toHaveBeenCalledTimes(1);
    });

    it('distincts between log levels', () => {
      const debug = jest.spyOn(logger, 'debug');
      const info = jest.spyOn(logger, 'info');

      function doSomething() {
        logger.once.debug('test');
        logger.once.info('test');
      }

      doSomething();
      doSomething();
      doSomething();
      expect(debug).toHaveBeenCalledTimes(1);
      expect(info).toHaveBeenCalledTimes(1);
    });

    it('distincts between different log statements', () => {
      const debug = jest.spyOn(logger, 'debug');

      function doSomething() {
        logger.once.debug('foo');
        logger.once.debug('bar');
        logger.once.debug('baz');
      }

      doSomething();
      doSomething();
      doSomething();
      expect(debug).toHaveBeenNthCalledWith(1, 'foo');
      expect(debug).toHaveBeenNthCalledWith(2, 'bar');
      expect(debug).toHaveBeenNthCalledWith(3, 'baz');
    });

    it('allows mixing single-time and regular logging', () => {
      const debug = jest.spyOn(logger, 'debug');

      function doSomething() {
        logger.once.debug('foo');
        logger.debug('bar');
        logger.once.debug({ some: 'data' }, 'baz');
      }

      doSomething();
      doSomething();
      doSomething();

      expect(debug).toHaveBeenNthCalledWith(1, 'foo');
      expect(debug).toHaveBeenNthCalledWith(2, 'bar');
      expect(debug).toHaveBeenNthCalledWith(3, { some: 'data' }, 'baz');

      expect(debug).toHaveBeenNthCalledWith(4, 'bar');

      expect(debug).toHaveBeenNthCalledWith(5, 'bar');
    });

    it('supports reset method', () => {
      const debug = jest.spyOn(logger, 'debug');

      function doSomething() {
        logger.once.debug('foo');
      }

      doSomething();
      logger.once.reset();
      doSomething();

      expect(debug).toHaveBeenCalledTimes(2);
    });
  });
});
