import { instrument, instrumentStandalone } from './decorator.ts';
import { disableInstrumentations } from './index.ts';

afterAll(disableInstrumentations);

describe('instrumentation/decorator', () => {
  describe('instrument', () => {
    it('should decorate class method', async () => {
      const spy = vi.fn(() => Promise.resolve(42));

      class MyClass {
        @instrument({ name: 'getNumber' })
        public async getNumber(): Promise<number> {
          return await spy();
        }
      }

      const myClass = new MyClass();
      const result = await myClass.getNumber();

      expect(result).toBe(42);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('instrumentStandalone', () => {
    it('should wrap standalone function', async () => {
      const spy = vi.fn(() => Promise.resolve('ok'));

      const fn = instrumentStandalone(
        { name: 'standaloneTest' },
        async (arg: string) => {
          await spy();
          return `hello ${arg}`;
        },
      );

      const result = await fn('world');
      expect(result).toBe('hello world');
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
