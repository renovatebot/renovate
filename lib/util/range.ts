export function* range(
  start: number,
  end: number
): Generator<number, void, void> {
  if (start > end) {
    return;
  }
  yield start;
  if (start === end) {
    return;
  }
  yield* range(start + 1, end);
}
