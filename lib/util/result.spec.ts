import { Result } from './result';

describe('util/result', () => {
  describe('ok', () => {
    it('should return true when the result is ok', () => {
      expect(Result.ok('foo').ok).toBe(true);
    });

    it('should return false when the result is not ok', () => {
      expect(Result.err().ok).toBe(false);
    });
  });

  describe('value', () => {
    it('should return the value when the result is ok', () => {
      expect(Result.ok('foo').value()).toBe('foo');
    });

    it('should return the fallback value when the result is not ok and a fallback is provided', () => {
      expect(Result.err('foo').value('bar')).toBe('bar');
    });

    it('should throw the error when the result is not ok and no fallback is provided', () => {
      expect(() => Result.err('foo').value()).toThrow('foo');
    });
  });

  describe('error', () => {
    it('should return undefined when the result is ok', () => {
      expect(Result.ok('foo').error()).toBeNull();
    });

    it('should return the error when the result is not ok', () => {
      const error = new Error('oops');
      const res = Result.err(error);
      expect(res.error()).toBe(error);
    });
  });

  describe('transform', () => {
    const fn = (value: string) => value.toUpperCase();

    it('should apply the transformation function to the value when the result is ok', () => {
      expect(Result.ok('foo').transform(fn).value()).toBe('FOO');
    });

    it('should return the error when the result is not ok', () => {
      const res = Result.err().transform(fn);
      expect(res.error()).toBeDefined();
      expect(() => res.value()).toThrow();
    });
  });
});
