import { instrument, instrumentStandalone } from './decorator';
import { disableInstrumentations } from '.';

afterAll(disableInstrumentations);

describe('instrumentation/decorator', () => {
  describe('instrument', () => {
    const spy = vi.fn(() => Promise.resolve());

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

  describe('instrumentStandalone', () => {
    const spy = vi.fn(() => Promise.resolve('ok'));

    it('should instrument a standalone async function', async () => {
      const fn = instrumentStandalone(
        { name: 'standaloneTest' },
        async function testFn(arg: string) {
          await spy();
          return `hello ${arg}`;
        },
      );

      const result = await fn('world');
      expect(result).toBe('hello world');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should pass all arguments to the wrapped function', async () => {
      const fn = instrumentStandalone(
        { name: 'multiArgTest' },
        async function testFn(a: number, b: number) {
          await spy();
          return a + b;
        },
      );

      const result = await fn(2, 3);
      expect(result).toBe(5);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
