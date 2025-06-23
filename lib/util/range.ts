export function* range(
  start: number,
  end: number,
): Generator<number, void, void> {
  for (let i = start; i <= end; i += 1) {
    yield i;
  }
  return;
}
