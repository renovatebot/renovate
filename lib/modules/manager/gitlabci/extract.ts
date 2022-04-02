import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { getDep } from '../dockerfile/extract';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type { GitlabPipeline, Image, JobTemplate, Services } from './types';
import { replaceReferenceTags } from './utils';

export function extractFromImage(image: Image | undefined): PackageDependency {
  if (is.undefined(image)) {
    return undefined;
  }
  let dep: PackageDependency = {};
  if (is.string(image)) {
    dep = getDep(image);
    dep.depType = 'image';
    return dep;
  }
  dep = getDep(image.name);
  dep.depType = 'image-name';
  return dep;
}

export function extractFromServices(
  services: Services | undefined
): PackageDependency[] {
  if (is.undefined(services)) {
    return undefined;
  }

  const deps: PackageDependency[] = [];
  let dep: PackageDependency<Record<string, any>> = {};
  for (const s of services) {
    if (is.string(s)) {
      dep = getDep(s);
      dep.depType = 'service-image';
    } else {
      dep = getDep(s.name);
      dep.depType = 'service-image';
    }
    deps.push(dep);
  }

  return deps;
}

export function extractFromObject(
  property: string,
  value: Image | JobTemplate | undefined
): PackageDependency[] {
  if (is.undefined(value)) {
    return undefined;
  }
  if (is.string(value) && property === 'image') {
    return [extractFromImage(value as Image)];
  }

  let deps: PackageDependency[] = [];
  const { image, services } = { ...(value as JobTemplate) };
  if (!is.undefined(image)) {
    deps.push(extractFromImage(image));
  }
  if (!is.undefined(services)) {
    deps = deps.concat(extractFromServices(services));
  }

  return deps;
}

export function extractPackageFile(content: string): PackageFile | null {
  let deps: PackageDependency[] = [];
  try {
    const doc = load(replaceReferenceTags(content), {
      json: true,
    });
    for (const [property, value] of Object.entries(doc)) {
      switch (property) {
        case 'image':
          deps.push(extractFromImage(value as Image));
          break;

        case 'services':
          deps = deps.concat(extractFromServices(value as Services));
          break;

        default:
          deps = deps.concat(extractFromObject(property, value));
          break;
      }
    }
    deps = deps.filter((dep) => dep !== undefined);
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting GitLab CI dependencies');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
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
    const file = filesToExamine.pop();

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
