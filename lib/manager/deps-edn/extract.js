const { DEFAULT_MAVEN_REPO } = require('../maven/extract');
const { expandDepName, DEFAULT_CLOJARS_REPO } = require('../leiningen/extract');

function extractPackageFile(content) {
  const deps = [];

  const regex = /([^{\s,]*)[\s,]*{[\s,]*:mvn\/version[\s,]+"([^"]+)"[\s,]*}/;
  let rest = content;
  let match = rest.match(regex);
  let offset = 0;
  while (match) {
    const [wholeSubstr, depName, currentValue] = match;
    const fileReplacePosition =
      offset + match.index + wholeSubstr.indexOf(currentValue);

    offset += match.index + wholeSubstr.length;
    rest = content.slice(offset);
    match = rest.match(regex);

    deps.push({
      datasource: 'maven',
      depName: expandDepName(depName),
      currentValue,
      fileReplacePosition,
      registryUrls: [DEFAULT_CLOJARS_REPO, DEFAULT_MAVEN_REPO],
    });
  }

  return { deps };
}

module.exports = {
  extractPackageFile,
};
