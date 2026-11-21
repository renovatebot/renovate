import is from '@sindresorhus/is';
import type { CollectionTag, Document } from 'yaml';
import {
  Scalar,
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseAllDocuments,
} from 'yaml';
import { logger } from '../../../logger/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { Result } from '../../../util/result.ts';
import { parseYaml } from '../../../util/yaml.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { id as semverPartialId } from '../../versioning/semver-partial/index.ts';
import { buildRefDigestProps } from '../gitlabci-include/parse.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types.ts';
import { Job, Jobs, MultiDocumentLocalIncludes } from './schema.ts';
import { getGitlabDep } from './utils.ts';

// GitLab `!reference` tags point at other parts of the configuration,
// so they are resolved to `null` instead of being read as values.
// A `Scalar` is returned because `yaml` ignores a bare `null` result.
// See https://docs.gitlab.com/ci/yaml/yaml_optimization/#reference-tags
const referenceTag: CollectionTag = {
  tag: '!reference',
  collection: 'seq',
  resolve: () => new Scalar(null),
};

// See https://docs.gitlab.com/ee/ci/components/index.html#use-a-component
const componentReferenceRegex = regEx(
  /(?<fqdn>[^/]+)\/(?<projectPath>.+)\/(?:.+)@(?<specificVersion>.+)/,
);

interface ComponentEntry {
  component: string;
  keyStart: number;
  valueNode: Scalar;
  valueRange: [number, number, number];
  isFlow: boolean;
}

function resolveNode(node: unknown, doc: Document): unknown {
  if (isAlias(node)) {
    return node.resolve(doc);
  }
  return node;
}

function extractComponentEntry(
  rawNode: unknown,
  doc: Document,
): ComponentEntry | null {
  const node = resolveNode(rawNode, doc);
  if (!isMap(node)) {
    return null;
  }

  for (const item of node.items) {
    if (
      isScalar(item.key) &&
      item.key.value === 'component' &&
      isScalar(item.value) &&
      is.string(item.value.value)
    ) {
      return {
        component: item.value.value,
        keyStart: item.key.range![0],
        valueNode: item.value,
        valueRange: item.value.range!,
        isFlow: node.flow === true,
      };
    }
  }

  return null;
}

function extractIncludedComponents(
  rawNode: unknown,
  doc: Document,
): ComponentEntry[] {
  const node = resolveNode(rawNode, doc);
  if (isSeq(node)) {
    const entries: ComponentEntry[] = [];
    for (const item of node.items) {
      const entry = extractComponentEntry(item, doc);
      if (entry) {
        entries.push(entry);
      }
    }
    return entries;
  }

  const entry = extractComponentEntry(node, doc);
  return entry ? [entry] : [];
}

function findComponentEntries(node: unknown, doc: Document): ComponentEntry[] {
  if (isSeq(node)) {
    const entries: ComponentEntry[] = [];
    for (const item of node.items) {
      entries.push(...findComponentEntries(item, doc));
    }
    return entries;
  }

  if (!isMap(node)) {
    return [];
  }

  const childrenEntries: ComponentEntry[] = [];
  const includeEntries: ComponentEntry[] = [];

  for (const item of node.items) {
    if (isScalar(item.key) && item.key.value === 'include') {
      includeEntries.push(...extractIncludedComponents(item.value, doc));
    } else {
      childrenEntries.push(...findComponentEntries(item.value, doc));
    }
  }

  return [...childrenEntries, ...includeEntries];
}

function extractDepFromIncludeComponent(
  entry: ComponentEntry,
  content: string,
  registryAliases?: Record<string, string>,
): PackageDependency | null {
  let componentUrl = entry.component;
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

  const atIndex = entry.component.lastIndexOf('@');
  const valuePrefix = entry.component.slice(0, atIndex + 1);

  return {
    datasource: GitlabTagsDatasource.id,
    depName: componentReference.projectPath,
    depType: 'repository',
    registryUrls: [`https://${componentReference.fqdn}`],
    versioning: semverPartialId,
    ...buildRefDigestProps({
      content,
      keyStart: entry.keyStart,
      valueNode: entry.valueNode,
      valueRange: entry.valueRange,
      ref: componentReference.specificVersion,
      valuePrefix,
      isFlow: entry.isFlow,
    }),
  };
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  try {
    const rawDocs = parseAllDocuments(content, {
      prettyErrors: true,
      uniqueKeys: false,
      strict: false,
      customTags: [referenceTag],
    });

    for (const rawDoc of rawDocs) {
      if (rawDoc.errors.length) {
        throw new AggregateError(rawDoc.errors, 'Failed to parse YAML file');
      }

      const doc = rawDoc.toJS({ maxAliasCount: 10000 });
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

      const includedComponents = findComponentEntries(rawDoc.contents, rawDoc);
      for (const includedComponent of includedComponents) {
        const dep = extractDepFromIncludeComponent(
          includedComponent,
          content,
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
      parseYaml(content, { uniqueKeys: false, customTags: [referenceTag] }),
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
    // v8 ignore else -- needs a listed file that yields no deps
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
