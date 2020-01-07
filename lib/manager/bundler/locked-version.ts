import { isValid } from '../../versioning/ruby';

const DEP_REGEX = '(?<=\\().*(?=\\))';
export function extractLockFileEntries(
  lockFileContent: string
): Map<string, string> {
  const gemLock = new Map<string, string>();
  let parsingGemSection = false;
  lockFileContent.split('\n').forEach(eachLine => {
    const whitespace = eachLine.indexOf(eachLine.trim());

    const isGemLine = eachLine.trim().startsWith('GEM');

    if (parsingGemSection === false && whitespace === 0 && isGemLine) {
      parsingGemSection = isGemLine;
    }

    if (parsingGemSection === true && whitespace === 0 && !isGemLine) {
      parsingGemSection = false;
    }

    // as per original ruby lockfile parser,a line whitespace 2,4,6 contains dependencies.
    if (whitespace === 4 && parsingGemSection) {
      // checking if the dependency string has version or not
      const depString = eachLine.match(DEP_REGEX);

      if (depString) {
        const depValue = depString[0];
        const depName = eachLine
          .replace(depValue, '')
          .replace('()', '')
          .trim();

        const isValidVersion = isValid(depValue);

        if (!gemLock.get(depName) && isValidVersion) {
          gemLock.set(depName, depValue);
        }
      }
    }
  });
  return gemLock;
}
