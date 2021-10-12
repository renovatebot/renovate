import { load } from 'js-yaml';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { regEx } from '../../util/regex';
import { ExtractConfig, PackageDependency, PackageFile } from '../types';

const chartRegex = regEx('^(?<registryRef>[^/]*)/(?<lookupName>[^/]*)$');

function createDep(key: string, doc: any): PackageDependency {
  const dep: PackageDependency = {
    depName: key,
  };
  const anApp = doc.apps[key];
  if (!anApp) {
    return null;
  }

  if (!anApp.version) {
    dep.skipReason = SkipReason.NoVersion;
    return dep;
  }
  dep.currentValue = anApp.version;

  const regexResult = chartRegex.exec(anApp.chart);
  if (!regexResult) {
    dep.skipReason = SkipReason.InvalidUrl;
    return dep;
  }

  if (!regexResult.groups.lookupName) {
    dep.skipReason = SkipReason.InvalidName;
    return dep;
  }
  dep.lookupName = regexResult.groups.lookupName;

  const registryUrl = doc.helmRepos[regexResult.groups.registryRef];
  if (!registryUrl) {
    dep.skipReason = SkipReason.NoRepository;
    return dep;
  }
  dep.registryUrls = [registryUrl];

  return dep;
}

export function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): PackageFile | null {
  try {
    // TODO: fix me (#9610)
    const doc: any = load(content, {
      json: true,
    });
    if (!(doc?.helmRepos && doc.apps)) {
      logger.debug({}, 'Missing helmRepos and/or apps keys');
      return null;
    }

    const deps = Object.keys(doc.apps).map((key) => createDep(key, doc));

    if (deps.filter(Boolean).length === 0) {
      return null;
    }

    return { deps };
  } catch (err) /* istanbul ignore next */ {
    if (err.stack?.startsWith('YAMLException:')) {
      logger.debug({ err }, 'YAML exception extracting');
    } else {
      logger.warn({ err }, 'Error extracting');
    }
    return null;
  }
}
