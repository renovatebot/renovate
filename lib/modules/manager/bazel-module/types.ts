export class Stack<T> extends Array<T> {
  static create<T>(...items: Array<T>): Stack<T> {
    const stack = new Stack<T>();
    stack.push(...items);
    return stack;
  }

  get current(): T | null {
    if (!this.length) {
      return null;
    }
    return this[this.length - 1];
  }
}
