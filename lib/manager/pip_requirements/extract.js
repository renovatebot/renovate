// based on https://www.python.org/dev/peps/pep-0508/#names
const packagePattern = '([A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9])';

module.exports = {
  packagePattern,
  extractDependencies,
};

function extractDependencies(fileContent) {
  const regex = new RegExp(`^${packagePattern}==[0-9.]+$`, 'g');
  return fileContent
    .split('\n')
    .map((line, lineNumber) => {
      const matches = regex.exec(line);
      return (
        matches && {
          depName: matches[1],
          depType: 'python',
          currentVersion: matches[2],
          lineNumber,
        }
      );
    })
    .filter(Boolean);
}
