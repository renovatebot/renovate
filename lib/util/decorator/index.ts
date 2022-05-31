export type Handler<T> = (
  parameters: DecoratorParameters<T>
) => Promise<unknown>;
export type Method<T> = (this: T, ...args: any[]) => Promise<any>;
export type Decorator<T> = <U extends T>(
  target: U,
  key: keyof U,
  descriptor: TypedPropertyDescriptor<Method<T>>
) => TypedPropertyDescriptor<Method<T>>;

export interface DecoratorParameters<T, U extends any[] = any[]> {
  /**
   * Current call arguments.
   */
  args: U;

  /**
   * A callback to call the decorated method with the current arguments.
   */
  callback(): unknown;

  /**
   * Current call context.
   */
  instance: T;
}

/**
 * Applies decorating function to intercept decorated method calls.
 * @param fn - The decorating function.
 */
export function decorate<T>(fn: Handler<T>): Decorator<T> {
  const result: Decorator<T> = (
    target,
    key,
    /* TODO: Can descriptor be undefined ? */
    descriptor = Object.getOwnPropertyDescriptor(target, key) ?? {
      enumerable: true,
      configurable: true,
      writable: true,
    }
  ) => {
    const { value } = descriptor;

    return Object.assign(descriptor, {
      value(this: T, ...args: any[]) {
        return fn({
          args,
          instance: this,
          callback: () => value?.apply(this, args),
        });
      },
    });
  };

  return result;
}
