import { disableInstrumentations } from './index.ts';
import { instrumented } from './instrumented.ts';

afterAll(disableInstrumentations);

describe('instrumentation/instrumented', () => {
  it('instruments async function', async () => {
    const spy = vi.fn(() => Promise.resolve(42));

    const result = await instrumented({ name: 'test-span' }, spy);

    expect(result).toBe(42);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('instruments multiple calls', async () => {
    const spy = vi.fn(() => Promise.resolve('ok'));

    await instrumented({ name: 'test-span' }, spy);
    await instrumented({ name: 'test-span' }, spy);
    const result = await instrumented({ name: 'test-span' }, spy);

    expect(result).toBe('ok');
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('propagates errors', async () => {
    const spy = vi.fn(() => Promise.reject(new Error('test error')));

    await expect(instrumented({ name: 'test-span' }, spy)).rejects.toThrow(
      'test error',
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('accepts options', async () => {
    const spy = vi.fn(() => Promise.resolve('result'));

    const result = await instrumented(
      {
        name: 'test-span',
        attributes: { 'custom.attr': 'value' },
        ignoreParentSpan: true,
      },
      spy,
    );

    expect(result).toBe('result');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
