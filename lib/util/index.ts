export function sampleSize(array: string[], n: number): string[] {
  const length = array ? array.length : 0;
  if (!length || n < 1) {
    return [];
  }

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
