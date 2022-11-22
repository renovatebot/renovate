import { afterAll } from '@jest/globals';
import { instrument } from './decorator';
import { disableInstrumentations } from '.';

afterAll(disableInstrumentations);

describe('instrumentation/decorator', () => {
  const spy = jest.fn(() => Promise.resolve());

  it('should instrument async function', async () => {
    class MyClass {
      @instrument({ name: 'getNumber' })
      public async getNumber(): Promise<number> {
        await spy();
        return Math.random();
      }
    }
    const myClass = new MyClass();
    const result = await myClass.getNumber();

    expect(result).toBeDefined();
    expect(result).toBeNumber();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should instrument multiple async function calls', async () => {
    class MyClass {
      @instrument({ name: 'getNumber' })
      public async getNumber(): Promise<number> {
        await spy();
        return Math.random();
      }
    }
    const myClass = new MyClass();
    await myClass.getNumber();
    await myClass.getNumber();
    const result = await myClass.getNumber();

    expect(result).toBeDefined();
    expect(result).toBeNumber();

    expect(spy).toHaveBeenCalledTimes(3);
  });
});
