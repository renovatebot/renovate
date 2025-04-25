import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { Result } from '../../../util/result';
import { parseYaml } from '../../../util/yaml';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types';
import {
  GitlabDocument,
  Job,
  Jobs,
  MultiDocumentLocalIncludes,
} from './schema';
import { getGitlabDep } from './utils';

// See https://docs.gitlab.com/ee/ci/components/index.html#use-a-component
const componentReferenceRegex = regEx(
  /(?<fqdn>[^/]+)\/(?<projectPath>.+)\/(?:.+)@(?<specificVersion>.+)/,
);
const componentReferenceLatestVersion = '~latest';

function extractDepFromIncludeComponent(
  component: string,
  registryAliases?: Record<string, string>,
): PackageDependency | null {
  let componentUrl = component;
  if (registryAliases) {
    for (const key in registryAliases) {
      componentUrl = componentUrl.replace(key, registryAliases[key]);
    }
  }
  const componentReference = componentReferenceRegex.exec(componentUrl)?.groups;
  if (!componentReference) {
    logger.debug(
      { componentReference: componentUrl },
      'Ignoring malformed component reference',
    );
    return null;
  }
  const projectPathParts = componentReference.projectPath.split('/');
  if (projectPathParts.length < 2) {
    logger.debug(
      { componentReference: componentUrl },
      'Ignoring component reference with incomplete project path',
    );
    return null;
  }

  const dep: PackageDependency = {
    datasource: GitlabTagsDatasource.id,
    depName: componentReference.projectPath,
    depType: 'repository',
    currentValue: componentReference.specificVersion,
    registryUrls: [`https://${componentReference.fqdn}`],
  };
  if (dep.currentValue === componentReferenceLatestVersion) {
    logger.debug(
      { componentVersion: dep.currentValue },
      'Ignoring component version',
    );
    dep.skipReason = 'unsupported-version';
  }
  return dep;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  try {
    const docs = parseYaml(content, { uniqueKeys: false });

    for (const doc of docs) {
      const topLevel = Job.parse(doc);
      const jobs = Jobs.parse(doc);

      for (const job of [topLevel, ...jobs]) {
        const { image, services } = job;

        if (image) {
          const dep = getGitlabDep(image.value, config.registryAliases);
          dep.depType = image.type;
          deps.push(dep);
        }

        for (const service of services) {
          const dep = getGitlabDep(service, config.registryAliases);
          dep.depType = 'service-image';
          deps.push(dep);
        }
      }

      const includedComponents = GitlabDocument.parse(doc);
      for (const includedComponent of includedComponents) {
        const dep = extractDepFromIncludeComponent(
          includedComponent,
          config.registryAliases,
        );
        if (dep) {
          deps.push(dep);
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.stack?.startsWith('YAMLException:')) {
      logger.debug(
        { err, packageFile },
        'YAML exception extracting GitLab CI includes',
      );
    } else {
      logger.debug(
        { err, packageFile },
        'Error extracting GitLab CI dependencies',
      );
    }
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

    const { val: docs, err } = Result.wrap(() =>
      parseYaml(content, { uniqueKeys: false }),
    ).unwrap();

    if (err) {
      logger.debug(
        { err, packageFile: file },
        'Error extracting GitLab CI dependencies',
      );
      continue;
    }

    const localIncludes = MultiDocumentLocalIncludes.parse(docs);
    for (const file of localIncludes) {
      if (!seen.has(file)) {
        seen.add(file);
        filesToExamine.push(file);
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
