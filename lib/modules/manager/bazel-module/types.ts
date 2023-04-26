export class Stack<T> extends Array<T> {
  static create<T>(...items: Array<T>): Stack<T> {
    const stack = new Stack<T>();
    stack.push(...items);
    return stack;
  }

  get safeCurrent(): T | undefined {
    if (!this.length) {
      return undefined;
    }
    return this[this.length - 1];
  }

  get current(): T {
    const c = this.safeCurrent;
    if (!c) {
      throw new Error('Requested current, but no value.');
    }
    return c;
  }
}
