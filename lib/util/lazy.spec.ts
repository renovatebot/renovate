import { Lazy } from './lazy';

describe('util/lazy', () => {
  describe('.getValue()', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('gets a value', () => {
      const spy = jest.fn().mockReturnValue(0);
      const lazy = new Lazy(() => spy());
      const value = lazy.getValue();
      expect(value).toEqual(0);
      expect(spy).toBeCalledTimes(1);
    });

    it('caches the value', () => {
      const spy = jest.fn().mockReturnValue(0);
      const lazy = new Lazy(() => spy());
      lazy.getValue();
      lazy.getValue();
      expect(spy).toBeCalledTimes(1);
    });

    it('throws an error', () => {
      const spy = jest.fn().mockImplementation(() => {
        throw new Error();
      });
      const lazy = new Lazy(() => spy());
      expect(() => lazy.getValue()).toThrow();
      expect(spy).toBeCalledTimes(1);
    });

    it('caches the error', () => {
      const spy = jest.fn().mockImplementation(() => {
        throw new Error();
      });
      const lazy = new Lazy(() => spy());
      expect(() => lazy.getValue()).toThrow();
      expect(() => lazy.getValue()).toThrow();
      expect(spy).toBeCalledTimes(1);
    });
  });

  describe('.hasValue()', () => {
    it('has a value', () => {
      const spy = jest.fn().mockReturnValue(0);
      const lazy = new Lazy(() => spy());
      lazy.getValue();
      const hasValue = lazy.hasValue();
      expect(hasValue).toBeTrue();
      expect(spy).toBeCalledTimes(1);
    });

    it('does not have a value', () => {
      const spy = jest.fn().mockReturnValue(0);
      const lazy = new Lazy(() => spy());
      const hasValue = lazy.hasValue();
      expect(hasValue).toBeFalse();
      expect(spy).toBeCalledTimes(0);
    });
  });
});
