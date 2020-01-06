const DEP_REGEX = '(?<=\\().*(?=\\))';
export function extractLockFileEntries(lockFileContent: string): any {
  const gemLock = { deps: [] };
  lockFileContent.split('\n').forEach(eachLine => {
    const whitespace = eachLine.indexOf(eachLine.trim());
    // as per original ruby lockfile parser,a line whitespace 2,4,6 contains dependencies.
    if (whitespace === 4) {
      // checking if the dependency string has version or not
      const depString = eachLine.match(DEP_REGEX);
      if (depString) {
        const depValue = depString[0];
        const depName = eachLine
          .replace(depValue, '')
          .replace('()', '')
          .trim();
        gemLock.deps.push({
          depName,
          lockedVersion: depValue,
        });
      }
    }
  });
  return gemLock;
}
