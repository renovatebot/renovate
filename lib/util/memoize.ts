interface Result<T = unknown> {
  res: T;
}

export function memoize<T = unknown>(callback: () => T): () => T {
  let memo: null | Result<T> = null;

  return (): T => {
    if (memo) {
      return memo.res;
    }

    const res = callback();
    memo = { res };
    return res;
  };
}
