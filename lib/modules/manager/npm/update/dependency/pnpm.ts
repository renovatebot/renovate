import { isNonEmptyArray, isNumber, isString } from '@sindresorhus/is';
import upath from 'upath';
import type { Document } from 'yaml';
import { CST, isCollection, isPair, isScalar, parseDocument } from 'yaml';
import { logger } from '../../../../../logger';
import {
  getSiblingFileName,
  localPathExists,
  readLocalFile,
  writeLocalFile,
} from '../../../../../util/fs';
import { matchRegexOrGlob } from '../../../../../util/string-match';
import { parseSingleYaml } from '../../../../../util/yaml';
import type { UpdateDependencyConfig } from '../../../types';
import type { PnpmWorkspaceFile } from '../../extract/types';
import { PnpmCatalogs } from '../../schema';
import { getNewGitValue, getNewNpmAliasValue } from './common';

export function updatePnpmCatalogDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { depType, managerData, depName } = upgrade;

  const catalogName = depType?.split('.').at(-1);

  /* v8 ignore next -- needs test */
  if (!isString(catalogName)) {
    logger.error(
      'No catalogName was found; this is likely an extraction error.',
    );
    return null;
  }

  let { newValue } = upgrade;

  newValue = getNewGitValue(upgrade) ?? newValue;
  newValue = getNewNpmAliasValue(newValue, upgrade) ?? newValue;

  logger.trace(
    `npm.updatePnpmCatalogDependency(): ${depType}:${/* v8 ignore next -- needs test */ managerData?.catalogName}.${depName} = ${newValue}`,
  );

  let document;
  let parsedContents;

  try {
    // In order to preserve the original formatting as much as possible, we want
    // manipulate the CST directly. Using the AST (the result of parseDocument)
    // does not guarantee that formatting would be the same after
    // stringification. However, the CST is more annoying to query for certain
    // values. Thus, we use both an annotated AST and a JS representation; the
    // former for manipulation, and the latter for querying/validation.
    document = parseDocument(fileContent, { keepSourceTokens: true });
    parsedContents = PnpmCatalogs.parse(document.toJS());
  } catch (err) {
    logger.debug({ err }, 'Could not parse pnpm-workspace YAML file.');
    return null;
  }

  // In pnpm-workspace.yaml, the default catalog can be either `catalog` or
  // `catalog.default`, but not both (pnpm throws outright with a config error).
  // Thus, we must check which entry is being used, to reference it from / set
  // it in the right place.
  const usesImplicitDefaultCatalog = parsedContents.catalog !== undefined;

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

  const modifiedDocument = changeDependencyIn(document, path, {
    newValue,
    newName: upgrade.newName,
  });

  if (!modifiedDocument) {
    // Case where we are explicitly unable to substitute the key/value, for
    // example if the value was an alias.
    return null;
  }

  /* v8 ignore next 3 -- this should not happen in practice, but we must satisfy the types */
  if (!modifiedDocument.contents?.srcToken) {
    return null;
  }

  return CST.stringify(modifiedDocument.contents.srcToken);
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
    /* v8 ignore next 3 -- the try..catch block above already throws if a key is an alias */
    if (!CST.isScalar(relevantNode.srcToken?.key)) {
      return null;
    }
    CST.setScalarValue(relevantNode.srcToken.key, newName);
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

/**
 * Update the minimumReleaseAgeExclude setting in pnpm-workspace.yaml if needed
 */
export async function updatePnpmWorkspace({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<void> {
  logger.debug('updatePnpmWorkspace()');
  const pnpmShrinkwrap = upgrade.managerData?.pnpmShrinkwrap;
  const lockFileDir = upath.dirname(pnpmShrinkwrap);
  const lockFileName = upath.join(lockFileDir, 'pnpm-lock.yaml');
  const pnpmWorkspaceFilePath = getSiblingFileName(
    lockFileName,
    'pnpm-workspace.yaml',
  );
  if (await localPathExists(pnpmWorkspaceFilePath)) {
    logger.debug('localPathExists()');
    const oldContent = (await readLocalFile(pnpmWorkspaceFilePath, 'utf8'))!;
    const pnpmWorkspace = parseSingleYaml<PnpmWorkspaceFile>(oldContent);
    if (!isNumber(pnpmWorkspace?.minimumReleaseAge)) {
      logger.debug('minimumReleaeAgeNotFound');
      return;
    }

    if (!isNonEmptyArray(pnpmWorkspace.minimumReleaseAgeExclude)) {
      logger.debug('Adding new exclude block');
      // add minimumReleaseAgeExclude
      const addedStr = `
        minimumReleaseAgeExclude:
         - ${upgrade.depName}@${upgrade.newValue}
      `;
      const newContent = oldContent + addedStr;
      await writeLocalFile(pnpmWorkspaceFilePath, newContent);
      return;
    }
    // check if exlcude setting exists for the dep
    let matchingSetting: {
      match: boolean;
      matchType?: 'pattern' | 'all-versions' | 'single-versions';
      settingStr: string;
    } = { match: false, settingStr: '' };
    for (const setting of pnpmWorkspace.minimumReleaseAgeExclude ?? []) {
      const matchingRes = checkExcludeSetting(setting, upgrade.depName!);
      if (matchingRes.match) {
        matchingSetting = {
          match: matchingRes.match,
          matchType: matchingRes.matchType,
          settingStr: setting,
        };
      }
    }

    if (matchingSetting.match) {
      logger.debug('Matching setting found');
      if (matchingSetting.matchType === 'single-versions') {
        logger.debug('Matching setting found, appending ||');
        // need to find and replace the old setting by appending || <newValue>
        const newSetting =
          matchingSetting.settingStr + ` || ${upgrade.newValue}`;
        const newContent = oldContent.replace(
          matchingSetting.settingStr,
          newSetting,
        );
        await writeLocalFile(pnpmWorkspaceFilePath, newContent);
      }
    }
  }
}

function checkExcludeSetting(
  setting: string,
  depName: string,
): {
  match: boolean;
  matchType?: 'pattern' | 'all-versions' | 'single-versions';
} {
  if (setting.includes(depName)) {
    if (!setting.includes('@')) {
      return { match: true, matchType: 'all-versions' };
    }
    return { match: true, matchType: 'single-versions' };
  }

  // check if setting is a pattern
  // TODO: use getRegexOrGlobPredicate method
  const res = matchRegexOrGlob(depName, setting);
  if (res) {
    return { match: true, matchType: 'pattern' };
  }

  return { match: false };
}
