import 'vitest';

declare global {
  var jest: typeof vi;

  namespace jest {
    type FunctionLike = (...args: any[]) => any;

    type Mock<T = any, Y extends any[] = any[]> = import('vitest').Mock<Y, T>;
    type MockInstance<
      T = any,
      Y extends any[] = any[]
    > = import('vitest').MockInstance<Y, T>;

    type Mocked<T> = import('vitest').Mocked<T>;
    type MockedFunction<T extends FunctionLike> =
      import('vitest').MockedFunction<T>;
    type MockedObject<T> = import('vitest').MockedObject<T>;

    type SpyInstance<
      T = any,
      Y extends any[] = any[]
    > = import('vitest').SpyInstance<Y, T>;
  }
}
