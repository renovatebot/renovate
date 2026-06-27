import { detectPlatform } from '../../../util/common.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { getHttpUrl } from '../../../util/git/url.ts';
import { regEx } from '../../../util/regex.ts';
import { parseUrl } from '../../../util/url.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { SwiftPackageRegistryDatasource } from '../../datasource/swift-package-registry/index.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types.ts';
import { discoverRegistryUrls } from './registries-json.ts';
import type { MatchResult } from './types.ts';

const regExps = {
  wildcard: regEx(/^.*?/),
  space: regEx(/(\s+|\/\/[^\n]*|\/\*.*\*\/)+/s),
  depsKeyword: regEx(/dependencies/),
  colon: regEx(/:/),
  beginSection: regEx(/\[/),
  endSection: regEx(/],?/),
  package: regEx(/\s*.\s*package\s*\(\s*/),
  urlKey: regEx(/url/),
  idKey: regEx(/id/),
  stringLiteral: regEx(/"[^"]+"/),
  comma: regEx(/,/),
  from: regEx(/from/),
  rangeOp: regEx(/\.\.[.<]/),
  exactVersion: regEx(/\.\s*exact\s*\(\s*/),
  exactVersionLabel: regEx(/\s*exact:/),
  traitsLabel: regEx(/\s*traits\s*:/),
  // This pattern consumes any `traits` content until the next package declaration,
  // as the traits syntax can be quite complex and does not need to be parsed in detail for package extraction.
  traitsConsumeToNextPackage: regEx(/.*\.\s*package\s*\(\s*/),
};

const WILDCARD = 'wildcard';
const SPACE = 'space';
const DEPS = 'depsKeyword';
const COLON = 'colon';
const BEGIN_SECTION = 'beginSection';
const END_SECTION = 'endSection';
const PACKAGE = 'package';
const URL_KEY = 'urlKey';
const ID_KEY = 'idKey';
const STRING_LITERAL = 'stringLiteral';
const COMMA = 'comma';
const FROM = 'from';
const RANGE_OP = 'rangeOp';
const EXACT_VERSION = 'exactVersion';
const EXACT_VERSION_LABEL = 'exactVersionLabel';
const TRAITS_LABEL = 'traitsLabel';
const TRAITS_CONSUME_TO_NEXT_PACKAGE = 'traitsConsumeToNextPackage';

const searchLabels = {
  wildcard: WILDCARD,
  space: SPACE,
  depsKeyword: DEPS,
  colon: COLON,
  beginSection: BEGIN_SECTION,
  endSection: END_SECTION,
  package: PACKAGE,
  urlKey: URL_KEY,
  idKey: ID_KEY,
  stringLiteral: STRING_LITERAL,
  comma: COMMA,
  from: FROM,
  rangeOp: RANGE_OP,
  exactVersion: EXACT_VERSION,
  exactVersionLabel: EXACT_VERSION_LABEL,
  traitsLabel: TRAITS_LABEL,
  traitsConsumeToNextPackage: TRAITS_CONSUME_TO_NEXT_PACKAGE,
};

function searchKeysForState(state: string | null): (keyof typeof regExps)[] {
  switch (state) {
    case 'dependencies':
      return [SPACE, COLON, WILDCARD];
    case 'dependencies:':
      return [SPACE, BEGIN_SECTION, WILDCARD];
    case 'dependencies: [':
      return [SPACE, PACKAGE, COMMA, TRAITS_LABEL, END_SECTION];
    case '.package(':
      return [SPACE, URL_KEY, ID_KEY, PACKAGE, END_SECTION];
    case '.package(url':
      return [SPACE, COLON, PACKAGE, END_SECTION];
    case '.package(id':
      return [SPACE, COLON, PACKAGE, END_SECTION];
    case '.package(url:':
      return [SPACE, STRING_LITERAL, PACKAGE, END_SECTION];
    case '.package(id:':
      return [SPACE, STRING_LITERAL, PACKAGE, END_SECTION];
    case '.package(url: [depName]':
      return [SPACE, COMMA, PACKAGE, END_SECTION];
    case '.package(url: [depName],':
      return [
        SPACE,
        FROM,
        STRING_LITERAL,
        RANGE_OP,
        EXACT_VERSION,
        EXACT_VERSION_LABEL,
        PACKAGE,
        END_SECTION,
      ];
    case '.package(url: [depName], .exact(':
      return [SPACE, STRING_LITERAL, PACKAGE, COMMA, TRAITS_LABEL, END_SECTION];
    case '.package(url: [depName], exact:':
      return [SPACE, STRING_LITERAL, PACKAGE, COMMA, TRAITS_LABEL, END_SECTION];
    case '.package(url: [depName], from':
      return [SPACE, COLON, PACKAGE, COMMA, TRAITS_LABEL, END_SECTION];
    case '.package(url: [depName], from:':
      return [SPACE, STRING_LITERAL, PACKAGE, COMMA, TRAITS_LABEL, END_SECTION];
    case '.package(url: [depName], [value]':
      return [SPACE, RANGE_OP, PACKAGE, COMMA, TRAITS_LABEL, END_SECTION];
    case '.package(url: [depName], [rangeFrom][rangeOp]':
      return [SPACE, STRING_LITERAL, PACKAGE, COMMA, TRAITS_LABEL, END_SECTION];
    case 'traits:':
      return [SPACE, TRAITS_CONSUME_TO_NEXT_PACKAGE];
    default:
      return [DEPS];
  }
}
function getMatch(str: string, state: string | null): MatchResult | null {
  const keys = searchKeysForState(state);
  let result: MatchResult | null = null;
  for (const key of keys) {
    const regex = regExps[key];
    const label = searchLabels[key];
    const match = regex.exec(str);
    if (match) {
      const idx = match.index;
      const substr = match[0];
      const len = substr.length;
      if (idx === 0) {
        return { idx, len, label, substr };
      }
      if (!result || idx < result.idx) {
        result = { idx, len, label, substr };
      }
    }
  }
  return result;
}

function parseDependencyUrl(
  url: string | null,
): { depName: string; datasource: string; registryUrls?: string[] } | null {
  // istanbul ignore if
  if (!url) {
    return null;
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = getHttpUrl(url);
  } catch {
    return null;
  }

  const parsedUrl = parseUrl(normalizedUrl);
  // v8 ignore if -- getHttpUrl always returns a parseable URL
  if (!parsedUrl) {
    return null;
  }
  const { host, pathname, protocol } = parsedUrl;
  const platform = detectPlatform(normalizedUrl);
  if (platform === 'github' || platform === 'gitlab') {
    const depName = pathname
      .replace(regEx(/^\//), '')
      .replace(regEx(/\.git$/), '')
      .replace(regEx(/\/$/), '');
    const datasource =
      platform === 'github' ? GithubTagsDatasource.id : GitlabTagsDatasource.id;

    const isGitHubPublic = host === 'github.com';
    const isGitLabPublic = host === 'gitlab.com';

    if (!isGitHubPublic && !isGitLabPublic) {
      const baseUrl = `${protocol}//${host}`;
      return { depName, datasource, registryUrls: [baseUrl] };
    }

    return { depName, datasource };
  }
  return { depName: url, datasource: GitTagsDatasource.id };
}

export function extractPackageFile(content: string): PackageFileContent | null {
  if (!content) {
    return null;
  }

  const deps: PackageDependency[] = [];
  const result: PackageFileContent = {
    deps,
  };

  let restStr = content;
  let state: string | null = null;
  let match = getMatch(restStr, state);

  let packageName: string | null = null;
  let currentValue: string | null = null;
  let currentForm: 'url' | 'id' = 'url';

  function yieldDep(): void {
    // istanbul ignore if
    if (!packageName) {
      return;
    }
    if (currentForm === 'id') {
      /* v8 ignore next: currentValue is always set before id-form yieldDep is reached on valid input */
      if (currentValue) {
        const dep: PackageDependency = {
          datasource: SwiftPackageRegistryDatasource.id,
          depName: packageName,
          packageName,
          currentValue,
        };
        deps.push(dep);
      }
    } else {
      const parsedUrl = parseDependencyUrl(packageName);
      if (parsedUrl && currentValue) {
        const {
          depName,
          datasource,
          registryUrls: depRegistryUrls,
        } = parsedUrl;

        const dep: PackageDependency = {
          datasource,
          depName,
          currentValue,
          ...(depRegistryUrls?.length && { registryUrls: depRegistryUrls }),
        };

        deps.push(dep);
      }
    }
    packageName = null;
    currentValue = null;
    currentForm = 'url';
  }

  while (match) {
    const { idx, len, label, substr } = match;

    switch (state) {
      case null:
        if (deps.length) {
          break;
        }
        if (label === DEPS) {
          state = 'dependencies';
        }
        break;
      case 'dependencies':
        if (label === COLON) {
          state = 'dependencies:';
        } else if (label !== SPACE) {
          state = null;
        }
        break;
      case 'dependencies:':
        if (label === BEGIN_SECTION) {
          state = 'dependencies: [';
        } else if (label !== SPACE) {
          state = null;
        }
        break;
      case 'dependencies: [':
        if (label === END_SECTION) {
          yieldDep();
          state = null;
        } else if (label === PACKAGE) {
          yieldDep();
          state = '.package(';
        } else if (label === TRAITS_LABEL) {
          state = 'traits:';
        }
        break;
      case '.package(':
        if (label === END_SECTION) {
          yieldDep();
          state = null;
        } else if (label === URL_KEY) {
          currentForm = 'url';
          state = '.package(url';
        } else if (label === ID_KEY) {
          currentForm = 'id';
          state = '.package(id';
        } else if (label === PACKAGE) {
          yieldDep();
        }
        break;
      case '.package(url':
        if (label === END_SECTION) {
          yieldDep();
          state = null;
        } else if (label === COLON) {
          state = '.package(url:';
        } else if (label === PACKAGE) {
          yieldDep();
          state = '.package(';
        }
        break;
      case '.package(id':
        if (label === END_SECTION) {
          yieldDep();
          state = null;
        } else if (label === COLON) {
          state = '.package(id:';
        } else if (
          /* v8 ignore next: defensive, mirrors the url-form's nested-`.package(` recovery path */
          label === PACKAGE
        ) {
          yieldDep();
          state = '.package(';
        }
        break;
      case '.package(url:':
        if (label === END_SECTION) {
          yieldDep();
          state = null;
        } else if (label === STRING_LITERAL) {
          packageName = substr
            .replace(regEx(/^"/), '')
            .replace(regEx(/"$/), '');
          state = '.package(url: [depName]';
        } else if (label === PACKAGE) {
          yieldDep();
          state = '.package(';
        }
        break;
      case '.package(id:':
        if (label === END_SECTION) {
          yieldDep();
          state = null;
        } else if (label === STRING_LITERAL) {
          packageName = substr
            .replace(regEx(/^"/), '')
            .replace(regEx(/"$/), '');
          // From here the version-clause grammar is identical to the
          // url-form, so reuse the existing post-name state.
          state = '.package(url: [depName]';
        } else if (label === PACKAGE) {
          yieldDep();
          state = '.package(';
        }
        break;
      case '.package(url: [depName]':
        if (label === END_SECTION) {
          yieldDep();
          state = null;
        } else if (label === COMMA) {
          state = '.package(url: [depName],';
        } else if (label === PACKAGE) {
          yieldDep();
          state = '.package(';
        }
        break;
      case '.package(url: [depName],':
        if (label === END_SECTION) {
          yieldDep();
          state = null;
        } else if (label === FROM) {
          currentValue = substr;
          state = '.package(url: [depName], from';
        } else if (label === STRING_LITERAL) {
          currentValue = substr;
          state = '.package(url: [depName], [value]';
        } else if (label === RANGE_OP) {
          currentValue = substr;
          state = '.package(url: [depName], [rangeFrom][rangeOp]';
        } else if (label === EXACT_VERSION) {
          state = '.package(url: [depName], .exact(';
        } else if (label === EXACT_VERSION_LABEL) {
          state = '.package(url: [depName], exact:';
        } else if (label === PACKAGE) {
          yieldDep();
          state = '.package(';
        }
        break;
      case '.package(url: [depName], .exact(':
        if (label === END_SECTION) {
          yieldDep();
          state = null;
        } else if (label === STRING_LITERAL) {
          currentValue = substr.slice(1, substr.length - 1);
          yieldDep();
        } else if (label === PACKAGE) {
          yieldDep();
          state = '.package(';
        }
        break;
      case '.package(url: [depName], exact:':
        if (label === END_SECTION) {
          yieldDep();
          state = null;
        } else if (label === STRING_LITERAL) {
          currentValue = substr.slice(1, substr.length - 1);
          yieldDep();
          state = 'dependencies: [';
        } else if (label === PACKAGE) {
          yieldDep();
          state = '.package(';
        }
        break;
      case '.package(url: [depName], from':
        if (label === END_SECTION) {
          yieldDep();
          state = null;
        } else if (label === COLON) {
          currentValue += substr;
          state = '.package(url: [depName], from:';
        } else if (label === SPACE) {
          currentValue += substr;
        } else if (label === PACKAGE) {
          yieldDep();
          state = '.package(';
        }
        break;
      case '.package(url: [depName], from:':
        if (label === END_SECTION) {
          yieldDep();
          state = null;
        } else if (label === STRING_LITERAL) {
          currentValue += substr;
          yieldDep();
          state = 'dependencies: [';
        } else if (label === SPACE) {
          currentValue += substr;
        } else if (label === PACKAGE) {
          yieldDep();
          state = '.package(';
        }
        break;
      case '.package(url: [depName], [value]':
        if (label === END_SECTION) {
          yieldDep();
          state = null;
        } else if (label === RANGE_OP) {
          currentValue += substr;
          state = '.package(url: [depName], [rangeFrom][rangeOp]';
        } else if (label === SPACE) {
          currentValue += substr;
        } else if (label === PACKAGE) {
          yieldDep();
          state = '.package(';
        }
        break;
      case '.package(url: [depName], [rangeFrom][rangeOp]':
        if (label === END_SECTION) {
          yieldDep();
          state = null;
        } else if (label === STRING_LITERAL) {
          currentValue += substr;
          state = 'dependencies: [';
        } else if (label === SPACE) {
          currentValue += substr;
        } else if (label === PACKAGE) {
          yieldDep();
          state = '.package(';
        }
        break;
      case 'traits:':
        if (label === TRAITS_CONSUME_TO_NEXT_PACKAGE) {
          yieldDep();
          state = '.package(';
        }
        break;
    }
    restStr = restStr.slice(idx + len);
    match = getMatch(restStr, state);
  }
  return deps.length ? result : null;
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[] | null> {
  const results: PackageFile[] = [];

  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (!content) {
      continue;
    }
    const parsed = extractPackageFile(content);
    if (!parsed) {
      continue;
    }

    // Attach discovered registry URLs to id-form deps so the
    // swift-package-registry datasource knows where to look. URL-form deps
    // already carry their own registryUrls (set by parseDependencyUrl).
    // If discoverRegistryUrls returns an empty list, the loop is a no-op.
    const registryUrls = await discoverRegistryUrls(packageFile);
    for (const dep of parsed.deps) {
      if (
        registryUrls.length &&
        dep.datasource === SwiftPackageRegistryDatasource.id &&
        !dep.registryUrls?.length
      ) {
        dep.registryUrls = registryUrls;
      }
    }

    results.push({ ...parsed, packageFile });
  }

  return results.length ? results : null;
}
