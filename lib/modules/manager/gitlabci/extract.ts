import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type { GitlabPipeline, Image, Job, Services } from './types';
import { getGitlabDep, replaceReferenceTags } from './utils';

export function extractFromImage(
  image: Image | undefined
): PackageDependency | null {
  if (is.undefined(image)) {
    return null;
  }
  let dep: PackageDependency | null = null;
  if (is.string(image)) {
    dep = getGitlabDep(image);
    dep.depType = 'image';
  } else if (is.string(image?.name)) {
    dep = getGitlabDep(image.name);
    dep.depType = 'image-name';
  }
  return dep;
}

export function extractFromServices(
  services: Services | undefined
): PackageDependency[] {
  if (is.undefined(services)) {
    return [];
  }
  const deps: PackageDependency[] = [];
  for (const service of services) {
    if (is.string(service)) {
      const dep = getGitlabDep(service);
      dep.depType = 'service-image';
      deps.push(dep);
    } else if (is.string(service?.name)) {
      const dep = getGitlabDep(service.name);
      dep.depType = 'service-image';
      deps.push(dep);
    }
  }
  return deps;
}

export function extractFromJob(job: Job | undefined): PackageDependency[] {
  if (is.undefined(job)) {
    return [];
  }
  const deps: PackageDependency[] = [];
  if (is.object(job)) {
    const { image, services } = { ...job };
    if (is.object(image) || is.string(image)) {
      const dep = extractFromImage(image);
      if (dep) {
        deps.push(dep);
      }
    }
    if (is.array(services)) {
      deps.push(...extractFromServices(services));
    }
  }
  return deps;
}

export function extractPackageFile(content: string): PackageFile | null {
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
              const dep = extractFromImage(value as Image);
              if (dep) {
                deps.push(dep);
              }
            }
            break;

          case 'services':
            deps.push(...extractFromServices(value as Services));
            break;

          default:
            deps.push(...extractFromJob(value as Job));
            break;
        }
      }
      deps = deps.filter(is.truthy);
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting GitLab CI dependencies');
  }

  return deps.length ? { deps } : null;
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  const filesToExamine = [...packageFiles];
  const seen = new Set<string>(packageFiles);
  const results: PackageFile[] = [];

  // extract all includes from the files
  while (filesToExamine.length > 0) {
    const file = filesToExamine.pop()!;

    const content = await readLocalFile(file, 'utf8');
    if (!content) {
      logger.debug({ file }, 'Empty or non existent gitlabci file');

      continue;
    }
    let doc: GitlabPipeline;
    try {
      doc = load(replaceReferenceTags(content), {
        json: true,
      }) as GitlabPipeline;
    } catch (err) {
      logger.warn({ err, file }, 'Error extracting GitLab CI dependencies');
      continue;
    }

    if (is.array(doc?.include)) {
      for (const includeObj of doc.include) {
        if (is.string(includeObj.local)) {
          const fileObj = includeObj.local.replace(regEx(/^\//), '');
          if (!seen.has(fileObj)) {
            seen.add(fileObj);
            filesToExamine.push(fileObj);
          }
        }
      }
    } else if (is.string(doc?.include)) {
      const fileObj = doc.include.replace(regEx(/^\//), '');
      if (!seen.has(fileObj)) {
        seen.add(fileObj);
        filesToExamine.push(fileObj);
      }
    }

    const result = extractPackageFile(content);
    if (result !== null) {
      results.push({
        packageFile: file,
        deps: result.deps,
      });
    }
  }

  logger.trace(
    { packageFiles, files: filesToExamine.entries() },
    'extracted all GitLab CI files'
  );

  if (!results.length) {
    return null;
  }

  return results;
}
