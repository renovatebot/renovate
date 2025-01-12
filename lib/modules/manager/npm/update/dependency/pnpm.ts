import is from '@sindresorhus/is';
import { CST, Parser } from 'yaml';
import { logger } from '../../../../../logger';
import { parseSingleYaml } from '../../../../../util/yaml';
import type { UpdateDependencyConfig } from '../../../types';
import { pnpmCatalogsSchema } from '../../extract/pnpm';
import { getNewGitValue, getNewNpmAliasValue } from './common';

export function updatePnpmCatalogDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { depType, managerData, depName } = upgrade;

  const catalogName = managerData?.catalogName;

  if (!is.string(catalogName)) {
    logger.error(
      'No catalogName was found; this is likely an extraction error.',
    );
    return null;
  }

  let { newValue } = upgrade;

  newValue = getNewGitValue(upgrade) ?? newValue;
  newValue = getNewNpmAliasValue(newValue, upgrade) ?? newValue;

  logger.trace(
    `npm.updatePnpmCatalogDependency(): ${depType}:${managerData?.catalogName}.${depName} = ${newValue}`,
  );

  let cstDocument: CST.Token;
  let parsedContents;

  try {
    // In order to preserve the original formatting as much as possible, we use
    // the CST directly. Using the AST (result of parseDocument) from 'yaml'
    // does not guarantee that formatting would be the same after
    // stringification. However, the CST is more annoying to query for certain
    // values. Thus, we parse both as a CST and as a JS representation; the
    // former for manipulation, and the latter for querying/validation. It is a bit
    // wasteful, but it works.
    cstDocument = Array.from(new Parser().parse(fileContent))[0];
    parsedContents = parseSingleYaml(fileContent, {
      customSchema: pnpmCatalogsSchema,
    });
  } catch (err) {
    logger.debug({ err }, 'Could not parse pnpm-workspace YAML file.');
    return null;
  }

  // In pnpm-workspace.yaml, the default catalog can be either `catalog` or
  // `catalog.default`, but not both (pnpm throws outright with a config error).
  // Thus, we must check which entry is being used, to reference it from the
  // right place.
  const usesImplicitDefaultCatalog = parsedContents.catalog !== undefined;

  // Save the old version
  const oldVersion =
    catalogName === 'default' && usesImplicitDefaultCatalog
      ? parsedContents.catalog?.[depName!]
      : parsedContents.catalogs?.[catalogName]?.[depName!];

  if (oldVersion === newValue) {
    logger.trace('Version is already updated');
    return fileContent;
  }

  // Update the value
  const path = getDepPath({
    depName: depName!,
    catalogName,
    usesImplicitDefaultCatalog,
  });

  const doc = changeDependencyIn(cstDocument, path, {
    newValue,
    newName: upgrade.newName,
  });

  if (!doc) {
    return null;
  }

  return CST.stringify(doc);
}

function changeDependencyIn(
  doc: CST.Token,
  path: string[],
  { newName, newValue }: { newName?: string; newValue?: string },
): CST.Document | null {
  if (doc.type !== 'document') {
    return null;
  }

  const relevantNode = findInYamlCst(doc, path);

  if (!relevantNode) {
    return null;
  }

  if (newName) {
    // TODO(fpapado): Think about this codepath a bit; can anchors / aliases appear in
    // key positions?
    if (!CST.isScalar(relevantNode.key)) {
      return null;
    }
    CST.setScalarValue(relevantNode.key, newName);
  }

  if (newValue) {
    // We only support scalar values when substituting. This explicitly avoids
    // substituting aliases, since those can be resolved from a shared location,
    // and replacing either the referrent anchor or the alias would be wrong in
    // the general case. We leave this up to the user, e.g. via a Regex custom
    // manager.
    if (!CST.isScalar(relevantNode.value)) {
      return null;
    }
    CST.setScalarValue(relevantNode.value, newValue);
  }

  return doc;
}

/**
 * Find the collection item in a nested YAML collection, starting from a YAML root.
 */
function findInYamlCst(
  root: CST.CollectionItem,
  path: string[],
): CST.CollectionItem | null {
  let currentNode = root;

  for (const segment of path) {
    if (!CST.isCollection(currentNode?.value)) {
      return null;
    }
    const newNode = currentNode.value.items.find((item) => {
      if (!CST.isScalar(item.key)) {
        return false;
      }
      const scalar = CST.resolveAsScalar(item.key);
      return scalar.value === segment;
    });

    if (!newNode) {
      return null;
    }

    currentNode = newNode;
  }

  return currentNode;
}

function getDepPath({
  catalogName,
  depName,
  usesImplicitDefaultCatalog,
}: {
  usesImplicitDefaultCatalog: boolean;
  catalogName: string;
  depName: string;
}): string[] {
  if (catalogName === 'default' && usesImplicitDefaultCatalog) {
    return ['catalog', depName];
  } else {
    return ['catalogs', catalogName, depName];
  }
}
