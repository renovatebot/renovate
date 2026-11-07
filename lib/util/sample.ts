export function sampleSize(
  array: string[] | null | undefined,
  n: number,
): string[] {
  if (!array?.length || n < 1) {
    return [];
  }
  const length = array.length;

  const sampleNumber = n > length ? length : n;
  let index = 0;
  const lastIndex = length - 1;
  const result = [...array];
  while (index < sampleNumber) {
    const rand = index + Math.floor(Math.random() * (lastIndex - index + 1));
    [result[rand], result[index]] = [result[index], result[rand]];
    index += 1;
  }
  return result.slice(0, sampleNumber);
}
