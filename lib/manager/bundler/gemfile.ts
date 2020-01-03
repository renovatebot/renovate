const DEP_REGEX = '(?<=\\().*(?=\\))';
function parseDepString(string): any {
  const depString = string.match(DEP_REGEX);
  if (depString) {
    const version = depString[0];
    return { version };
  }
  return null;
}
function parseLine(line): any {
  const whitespace = line.indexOf(line.trim());
  const key = line.split(':')[0].trim();
  const value = line
    .split(':')
    .slice(1)
    .join('')
    .trim();
  return {
    whiteSpace: whitespace,
    content: {
      key,
      value,
    },
  };
}

export function extractLockFileEntries(lockFileContent: string): any {
  const lines = lockFileContent.split('\n');
  const gemConfig = {};
  let previousWhiteSpace = 0;
  // keeps track of current
  const stack = [];
  lines.forEach(line => {
    //  if(line) {
    const parsedLine = parseLine(line);
    const currentWhiteSpace = parsedLine.whiteSpace;
    const key = parsedLine.content.key;
    const value = parsedLine.content.value;
    const depString = parseDepString(line);
    if (currentWhiteSpace === 0 && key) {
      gemConfig[key] = value || {};
      if (gemConfig[key].constructor.name === 'Object') {
        stack.push(gemConfig[key]);
      }
    }

    if (
      currentWhiteSpace === previousWhiteSpace &&
      currentWhiteSpace !== 0 &&
      previousWhiteSpace !== 0
    ) {
      const fetchedElement = stack[stack.length - 1];
      fetchedElement[key] = value || {};
      // if key is specs add object
      if (key === 'specs') stack.push(fetchedElement[key]);
      if (depString) {
        fetchedElement[key].version = depString.version;
      }
    }
    if (currentWhiteSpace > previousWhiteSpace && currentWhiteSpace) {
      const fetchedElement = stack[stack.length - 1];
      fetchedElement[key] = value || {};
      if (fetchedElement[key].constructor.name === 'Object') {
        stack.push(fetchedElement[key]);
      }
      if (depString) {
        fetchedElement[key].version = depString.version;
      }
    }
    if (currentWhiteSpace < previousWhiteSpace) {
      stack.pop();
    }
    previousWhiteSpace = currentWhiteSpace;
    // }
  });
  return gemConfig;
}
