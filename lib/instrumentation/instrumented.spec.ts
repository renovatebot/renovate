import { instrumented } from './instrumented';
import { disableInstrumentations } from '.';

afterAll(disableInstrumentations);

describe('instrumentation/instrumented', () => {
  it('wraps async function', async () => {
    const spy = vi.fn(() => Promise.resolve(42));
    const wrapped = instrumented({ name: 'test-span' }, spy);

    const result = await wrapped();

    expect(result).toBe(42);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('instruments multiple calls', async () => {
    const spy = vi.fn(() => Promise.resolve('ok'));
    const wrapped = instrumented({ name: 'test-span' }, spy);

    await wrapped();
    await wrapped();
    const result = await wrapped();

    expect(result).toBe('ok');
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('propagates errors', async () => {
    const spy = vi.fn(() => Promise.reject(new Error('test error')));
    const wrapped = instrumented({ name: 'test-span' }, spy);

    await expect(wrapped()).rejects.toThrow('test error');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('accepts options', async () => {
    const spy = vi.fn(() => Promise.resolve('result'));
    const wrapped = instrumented(
      {
        name: 'test-span',
        attributes: { 'custom.attr': 'value' },
        ignoreParentSpan: true,
      },
      spy,
    );

    const result = await wrapped();

    expect(result).toBe('result');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('passes arguments to wrapped function', async () => {
    const spy = vi.fn((a: number, b: string) => Promise.resolve(`${a}-${b}`));
    const wrapped = instrumented({ name: 'test-span' }, spy);

    const result = await wrapped(42, 'hello');

    expect(result).toBe('42-hello');
    expect(spy).toHaveBeenCalledWith(42, 'hello');
  });
});
