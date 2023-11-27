import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { trimLeadingSlash } from '../../../util/url';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types';
import { isGitlabIncludeLocal } from './common';
import type { GitlabPipeline, Image, Job, Services } from './types';
import { getGitlabDep, replaceReferenceTags } from './utils';

export function extractFromImage(
  image: Image | undefined,
  registryAliases?: Record<string, string>,
): PackageDependency | null {
  if (is.undefined(image)) {
    return null;
  }
  let dep: PackageDependency | null = null;
  if (is.string(image)) {
    dep = getGitlabDep(image, registryAliases);
    dep.depType = 'image';
  } else if (is.string(image?.name)) {
    dep = getGitlabDep(image.name, registryAliases);
    dep.depType = 'image-name';
  }
  return dep;
}

export function extractFromServices(
  services: Services | undefined,
  registryAliases?: Record<string, string>,
): PackageDependency[] {
  if (is.undefined(services)) {
    return [];
  }
  const deps: PackageDependency[] = [];
  for (const service of services) {
    if (is.string(service)) {
      const dep = getGitlabDep(service, registryAliases);
      dep.depType = 'service-image';
      deps.push(dep);
    } else if (is.string(service?.name)) {
      const dep = getGitlabDep(service.name, registryAliases);
      dep.depType = 'service-image';
      deps.push(dep);
    }
  }
  return deps;
}

export function extractFromJob(
  job: Job | undefined,
  registryAliases?: Record<string, string>,
): PackageDependency[] {
  if (is.undefined(job)) {
    return [];
  }
  const deps: PackageDependency[] = [];
  if (is.object(job)) {
    const { image, services } = { ...job };
    if (is.object(image) || is.string(image)) {
      const dep = extractFromImage(image, registryAliases);
      if (dep) {
        deps.push(dep);
      }
    }
    if (is.array(services)) {
      deps.push(...extractFromServices(services, registryAliases));
    }
  }
  return deps;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  let deps: PackageDependency[] = [];
  try {
    const doc = load(replaceReferenceTags(content), {
      json: true,
    }) as Record<string, Image | Services | Job>;
    if (is.object(doc)) {
      for (const [property, value] of Object.entries(doc)) {
        switch (property) {
          case 'image':
            {
              const dep = extractFromImage(
                value as Image,
                config.registryAliases,
              );
              if (dep) {
                deps.push(dep);
              }
            }
            break;

          case 'services':
            deps.push(
              ...extractFromServices(value as Services, config.registryAliases),
            );
            break;

          default:
            deps.push(...extractFromJob(value as Job, config.registryAliases));
            break;
        }
      }
      deps = deps.filter(is.truthy);
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      { err, packageFile },
      'Error extracting GitLab CI dependencies',
    );
  }

  return deps.length ? { deps } : null;
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[] | null> {
  const filesToExamine = [...packageFiles];
  const seen = new Set<string>(packageFiles);
  const results: PackageFile[] = [];

  // extract all includes from the files
  while (filesToExamine.length > 0) {
    const file = filesToExamine.pop()!;

    const content = await readLocalFile(file, 'utf8');
    if (!content) {
      logger.debug(
        { packageFile: file },
        `Empty or non existent gitlabci file`,
      );
      continue;
    }
    let doc: GitlabPipeline;
    try {
      doc = load(replaceReferenceTags(content), {
        json: true,
      }) as GitlabPipeline;
    } catch (err) {
      logger.debug(
        { err, packageFile: file },
        'Error extracting GitLab CI dependencies',
      );
      continue;
    }

    if (is.array(doc?.include)) {
      for (const includeObj of doc.include.filter(isGitlabIncludeLocal)) {
        const fileObj = trimLeadingSlash(includeObj.local);
        if (!seen.has(fileObj)) {
          seen.add(fileObj);
          filesToExamine.push(fileObj);
        }
      }
    } else if (is.string(doc?.include)) {
      const fileObj = trimLeadingSlash(doc.include);
      if (!seen.has(fileObj)) {
        seen.add(fileObj);
        filesToExamine.push(fileObj);
      }
    }

    const result = extractPackageFile(content, file, config);
    if (result !== null) {
      results.push({
        packageFile: file,
        deps: result.deps,
      });
    }
  }

  logger.trace(
    { packageFiles, files: filesToExamine.entries() },
    'extracted all GitLab CI files',
  );

  if (!results.length) {
    return null;
  }

  return results;
}
