import is from '@sindresorhus/is';
import type { Document } from 'yaml';
import { CST, isCollection, isPair, isScalar, parseDocument } from 'yaml';
import { logger } from '../../../../../logger';
import type { UpdateDependencyConfig } from '../../../types';
import { YarnConfig } from '../../schema';
import { getNewGitValue, getNewNpmAliasValue } from './common';

export function updateYarnrcCatalogDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { depType, depName } = upgrade;

  const catalogName = depType?.split('.').at(-1);

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
    `npm.updateYarnrcCatalogDependency(): ${depType}::${catalogName}.${depName} = ${newValue}`,
  );

  let document: ReturnType<typeof parseDocument>;
  let parsedContents: YarnConfig;

  try {
    // In order to preserve the original formatting as much as possible, we want
    // manipulate the CST directly. Using the AST (the result of parseDocument)
    // does not guarantee that formatting would be the same after
    // stringification. However, the CST is more annoying to query for certain
    // values. Thus, we use both an annotated AST and a JS representation; the
    // former for manipulation, and the latter for querying/validation.
    document = parseDocument(fileContent, { keepSourceTokens: true });
    parsedContents = YarnConfig.parse(document.toString());
  } catch (err) {
    logger.debug({ err }, 'Could not parse yarnrc YAML file.');
    return null;
  }

  const oldVersion =
    catalogName === 'default'
      ? parsedContents.catalogs?.list?.[depName!]
      : is.object(parsedContents.catalogs?.list?.[catalogName]) &&
          is.string(depName)
        ? parsedContents.catalogs?.list?.[catalogName][depName]
        : undefined;

  if (oldVersion === newValue) {
    logger.trace('Version is already updated');
    return fileContent;
  }

  // Update the value
  const path = getDepPath({
    depName: depName!,
    catalogName,
  });

  const modifiedDocument = changeDependencyIn(document, path, {
    newValue,
    newName: upgrade.newName,
  });

  if (!modifiedDocument) {
    // Case where we are explicitly unable to substitute the key/value, for
    // example if the value was an alias.
    return null;
  }

  return CST.stringify(modifiedDocument.contents!.srcToken!);
}

/**
 * Change the scalar name and/or value of a collection item in a YAML document,
 * while keeping formatting consistent. Mutates the given document.
 */
function changeDependencyIn(
  document: Document,
  path: string[],
  { newName, newValue }: { newName?: string; newValue?: string },
): Document | null {
  const parentPath = path.slice(0, -1);
  const relevantItemKey = path.at(-1);

  const parentNode = document.getIn(parentPath);

  if (!parentNode || !isCollection(parentNode)) {
    return null;
  }

  const relevantNode = parentNode.items.find(
    (item) =>
      isPair(item) && isScalar(item.key) && item.key.value === relevantItemKey,
  );

  if (!relevantNode || !isPair(relevantNode)) {
    return null;
  }

  if (newName) {
    /* the try..catch block above already throws if a key is an alias */
    CST.setScalarValue(relevantNode.srcToken!.key!, newName);
  }

  if (newValue) {
    // We only support scalar values when substituting. This explicitly avoids
    // substituting aliases, since those can be resolved from a shared location,
    // and replacing either the referrent anchor or the alias would be wrong in
    // the general case. We leave this up to the user, e.g. via a Regex custom
    // manager.
    if (!CST.isScalar(relevantNode.srcToken?.value)) {
      return null;
    }
    CST.setScalarValue(relevantNode.srcToken.value, newValue);
  }

  return document;
}

function getDepPath({
  catalogName,
  depName,
}: {
  catalogName: string;
  depName: string;
}): string[] {
  if (catalogName === 'default') {
    return ['catalogs', 'list', depName];
  } else {
    return ['catalogs', 'list', catalogName, depName];
  }
}
