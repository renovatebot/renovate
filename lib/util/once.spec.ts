import { once, reset } from './once';

describe('util/once', () => {
  afterEach(() => {
    reset();
  });

  it('should call a function only once', () => {
    const fn = jest.fn();

    once('key', fn);
    expect(fn).toHaveBeenCalledTimes(1);

    once('key', fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should call a function once per key', () => {
    const fn = jest.fn();
    once('key1', fn);
    expect(fn).toHaveBeenCalledTimes(1);

    once('key1', fn);
    expect(fn).toHaveBeenCalledTimes(1);

    once('key2', fn);
    expect(fn).toHaveBeenCalledTimes(2);

    once('key2', fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should reset the cache', () => {
    const fn = jest.fn();

    once('key', fn);
    expect(fn).toHaveBeenCalledTimes(1);

    reset();

    once('key', fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
