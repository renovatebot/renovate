// based on https://www.python.org/dev/peps/pep-0508/#names
const packagePattern = '([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9])';

module.exports = {
  packagePattern,
  extractDependencies,
};

function extractDependencies(fileName, content) {
  logger.debug('pip_requirements.extractDependencies()');
  // TODO: for now we only support semver, but we need better support for python versions
  // see https://github.com/pypa/packaging/blob/master/packaging/version.py
  // see https://www.python.org/dev/peps/pep-0440/#version-epochs
  const regex = new RegExp(
    `^${packagePattern}==([0-9]+\\.[0-9]+\\.[0-9]+)$`,
    'g'
  );
  const deps = content
    .split('\n')
    .map((line, lineNumber) => {
      const matches = regex.exec(line);
      return (
        matches && {
          depName: matches[1],
          currentVersion: matches[2],
          lineNumber,
        }
      );
    })
    .filter(Boolean);
  if (!deps.length) {
    return null;
  }
  return { deps };
}
