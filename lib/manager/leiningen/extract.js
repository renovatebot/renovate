const { DEFAULT_MAVEN_REPO } = require('../maven/extract');

const DEFAULT_CLOJARS_REPO = 'https://clojars.org/repo/';

function trimAtKey(str, kwName) {
  const regex = new RegExp(`:${kwName}(?=\\s)`);
  const keyOffset = str.search(regex);
  if (keyOffset < 0) return null;
  const withSpaces = str.slice(keyOffset + kwName.length + 1);
  const valueOffset = withSpaces.search(/[^\s]/);
  if (valueOffset < 0) return null;
  return withSpaces.slice(valueOffset);
}

function expandDepName(name) {
  return name.indexOf('/') === -1 ? `${name}:${name}` : name.replace('/', ':');
}

function extractFromVectors(str, offset = 0, ctx = {}) {
  if (str.indexOf('[') !== 0) return [];
  let balance = 0;
  const result = [];
  let idx = 0;
  let vecPos = 0;
  let artifactId = '';
  let version = '';
  let fileReplacePosition = null;

  const isSpace = ch => ch && /[\s,]/.test(ch);

  const cleanStrLiteral = s => s.replace(/^"/, '').replace(/"$/, '');

  const yieldDep = () => {
    if (artifactId && version && fileReplacePosition) {
      result.push({
        ...ctx,
        datasource: 'maven',
        depName: expandDepName(cleanStrLiteral(artifactId)),
        currentValue: cleanStrLiteral(version),
        fileReplacePosition,
      });
    }
    artifactId = '';
    version = '';
  };

  let prevChar = null;
  while (idx < str.length) {
    const char = str.charAt(idx);
    if (char === '[') {
      balance += 1;
      if (balance === 2) {
        vecPos = 0;
      }
    } else if (char === ']') {
      balance -= 1;
      if (balance === 1) {
        yieldDep();
      } else if (balance === 0) {
        break;
      }
    } else if (balance === 2) {
      if (isSpace(char)) {
        if (!isSpace(prevChar)) {
          vecPos += 1;
        }
      } else if (vecPos === 0) {
        artifactId += char;
      } else if (vecPos === 1) {
        if (isSpace(prevChar)) {
          fileReplacePosition = offset + idx + 1;
        }
        version += char;
      }
    }
    prevChar = char;
    idx += 1;
  }
  return result;
}

function extractLeinRepos(content) {
  const result = [DEFAULT_CLOJARS_REPO, DEFAULT_MAVEN_REPO];

  const repoContent = trimAtKey(
    content.replace(/;;.*(?=[\r\n])/g, ''), // get rid of comments
    'repositories'
  );

  if (repoContent) {
    let balance = 0;
    let endIdx = 0;
    for (let idx = 0; idx < repoContent.length; idx += 1) {
      const char = repoContent.charAt(idx);
      if (char === '[') {
        balance += 1;
      } else if (char === ']') {
        balance -= 1;
        if (balance <= 0) {
          endIdx = idx;
          break;
        }
      }
    }
    const repoSectionContent = repoContent.slice(0, endIdx);
    const matches = repoSectionContent.match(/"https?:\/\/[^"]*"/g) || [];
    const urls = matches.map(x => x.replace(/^"/, '').replace(/"$/, ''));
    urls.forEach(url => result.push(url));
  }

  return result;
}

function extractPackageFile(content) {
  const collect = (key, ctx) => {
    let result = [];
    let restContent = trimAtKey(content, key);
    while (restContent) {
      const offset = content.length - restContent.length;
      result = [...result, ...extractFromVectors(restContent, offset, ctx)];
      restContent = trimAtKey(restContent, key);
    }
    return result;
  };

  const registryUrls = extractLeinRepos(content);

  const deps = [
    ...collect('dependencies', {
      depType: 'dependencies',
      registryUrls,
    }),
    ...collect('managed-dependencies', {
      depType: 'managed-dependencies',
      registryUrls,
    }),
    ...collect('dev-dependencies', {
      depType: 'managed-dependencies',
      registryUrls,
    }),
    ...collect('plugins', {
      depType: 'plugins',
      registryUrls,
    }),
    ...collect('pom-plugins', {
      depType: 'pom-plugins',
      registryUrls,
    }),
  ];

  return { deps };
}

module.exports = {
  trimAtKey,
  extractFromVectors,
  expandDepName,
  DEFAULT_CLOJARS_REPO,
  extractPackageFile,
};
