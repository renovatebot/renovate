export function getRepoCache(): Record<string, any> {
  // eslint-disable-next-line no-return-assign
  return global.repoCache ?? (global.repoCache = {});
}

export function clearRepoCache(): void {
  global.repoCache = {};
}
