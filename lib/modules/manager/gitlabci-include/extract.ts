import is from '@sindresorhus/is';
import type { Document, Scalar } from 'yaml';
import { isAlias, isMap, isScalar, isSeq, parseAllDocuments } from 'yaml';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { buildRefDigestProps } from './parse.ts';

function resolveNode(node: unknown, doc: Document): unknown {
  if (isAlias(node)) {
    return node.resolve(doc);
  }
  return node;
}

function extractIncludeEntry(
  rawNode: unknown,
  doc: Document,
  content: string,
): PackageDependency | null {
  const node = resolveNode(rawNode, doc);
  if (!isMap(node)) {
    return null;
  }

  let project: string | undefined;
  let refKey: Scalar | undefined;
  let refValue: Scalar | undefined;
  let ref: string | undefined;

  for (const item of node.items) {
    if (!isScalar(item.key)) {
      continue;
    }

    if (
      item.key.value === 'project' &&
      isScalar(item.value) &&
      is.string(item.value.value)
    ) {
      project = item.value.value;
    } else if (
      item.key.value === 'ref' &&
      isScalar(item.value) &&
      is.string(item.value.value)
    ) {
      refKey = item.key;
      refValue = item.value;
      ref = item.value.value;
    }
  }

  if (!project) {
    return null;
  }

  const dep: PackageDependency = {
    datasource: GitlabTagsDatasource.id,
    depName: project,
    depType: 'repository',
  };

  if (!refKey || !refValue || !ref) {
    dep.skipReason = 'unspecified-version';
    return dep;
  }

  return {
    ...dep,
    ...buildRefDigestProps({
      content,
      keyStart: refKey.range![0],
      valueNode: refValue,
      valueRange: refValue.range!,
      ref,
      isFlow: node.flow === true,
    }),
  };
}

function extractIncludes(
  rawNode: unknown,
  doc: Document,
  content: string,
): PackageDependency[] {
  const node = resolveNode(rawNode, doc);
  if (isSeq(node)) {
    const deps: PackageDependency[] = [];
    for (const item of node.items) {
      const dep = extractIncludeEntry(item, doc, content);
      if (dep) {
        deps.push(dep);
      }
    }
    return deps;
  }

  const dep = extractIncludeEntry(node, doc, content);
  return dep ? [dep] : [];
}

function extractFromNode(
  node: unknown,
  doc: Document,
  content: string,
): PackageDependency[] {
  if (isSeq(node)) {
    const deps: PackageDependency[] = [];
    for (const item of node.items) {
      deps.push(...extractFromNode(item, doc, content));
    }
    return deps;
  }

  if (!isMap(node)) {
    return [];
  }

  const childrenDeps: PackageDependency[] = [];
  const includeDeps: PackageDependency[] = [];

  for (const item of node.items) {
    if (isScalar(item.key) && item.key.value === 'include') {
      includeDeps.push(...extractIncludes(item.value, doc, content));
    } else {
      childrenDeps.push(...extractFromNode(item.value, doc, content));
    }
  }

  return [...childrenDeps, ...includeDeps];
}

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  const platform = GlobalConfig.get('platform');
  const endpoint = GlobalConfig.get('endpoint');
  const registryUrls =
    platform === 'gitlab' && endpoint
      ? [endpoint.replace(regEx(/\/api\/v4\/?/), '')]
      : null;

  const docs = parseAllDocuments(content, {
    prettyErrors: true,
    uniqueKeys: false,
    strict: false,
  });

  for (const doc of docs) {
    if (doc.errors.length) {
      logger.debug(
        {
          err: new AggregateError(doc.errors, 'Failed to parse YAML file'),
          packageFile,
        },
        'Error extracting GitLab CI includes',
      );
      return null;
    }

    for (const dep of extractFromNode(doc.contents, doc, content)) {
      if (registryUrls) {
        dep.registryUrls = registryUrls;
      }
      deps.push(dep);
    }
  }

  if (!deps.length) {
    return null;
  }

  return { deps };
}
