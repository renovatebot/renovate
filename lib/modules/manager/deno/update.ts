import is from '@sindresorhus/is';
import { dequal } from 'dequal';
import upath from 'upath';
import { logger } from '../../../logger';
import { parseJsonc } from '../../../util/common';
import { matchAt, replaceAt } from '../../../util/string';
import { updateDependency as npmUpdateDependency } from '../npm';
import type { UpdateDependencyConfig } from '../types';
import { UpdateDenoJsonFile, UpdateImportMapJsonFile } from './schema';
import type { DenoManagerData } from './types';

function getValueByDatasource(
  datasource: string,
  depName: string,
  currentValue?: string | null,
): string | null {
  if (datasource === 'deno') {
    return currentValue ? `${depName}@${currentValue}` : depName;
  }
  if (datasource === 'jsr' || datasource === 'npm') {
    return currentValue
      ? `${datasource}:${depName}@${currentValue}`
      : `${datasource}:${depName}`;
  }
  return null;
}

// ported from lib/modules/manager/npm/update/dependency/index.ts
function replaceAsString(
  parsedContents: UpdateDenoJsonFile | UpdateImportMapJsonFile,
  fileContent: string,
  depType: string,
  searchString: string,
  newString: string,
): string {
  // Skip ahead to depType section
  let searchIndex = fileContent.indexOf(`"${depType}"`) + depType.length;
  logger.trace(`Starting search at index ${searchIndex}`);
  // Iterate through the rest of the file
  for (; searchIndex < fileContent.length; searchIndex += 1) {
    // First check if we have a hit for the old version
    if (matchAt(fileContent, searchIndex, searchString)) {
      logger.trace(`Found match at index ${searchIndex}`);
      // Now test if the result matches
      const testContent = replaceAt(
        fileContent,
        searchIndex,
        searchString,
        newString,
      );
      // Compare the parsed JSON/JSONC structure of old and new
      if (dequal(parsedContents, parseJsonc(testContent))) {
        return testContent;
      }
    }
    /* v8 ignore next 3 -- needs test */
  }
  throw new Error();
}

function updateImportMapLikeDepTypes(
  parsedContents: UpdateDenoJsonFile | UpdateImportMapJsonFile,
  fileContent: string,
  depType: string,
  searchString: string,
  newString: string,
): string | null {
  let newFileContent: string | null = null;

  if (depType === 'imports' && parsedContents.imports) {
    const matches = Object.entries(parsedContents.imports).filter(([, value]) =>
      value.includes(searchString),
    );
    for (const [key] of matches) {
      parsedContents.imports[key] = parsedContents.imports[key].replace(
        searchString,
        newString,
      );
      newFileContent = replaceAsString(
        parsedContents,
        fileContent,
        depType,
        searchString,
        newString,
      );
    }
  }

  if (depType === 'scopes' && parsedContents.scopes) {
    for (const scopeName of Object.keys(parsedContents.scopes)) {
      const scope = parsedContents.scopes[scopeName];
      const matches = Object.entries(scope).filter(([, value]) =>
        value.includes(searchString),
      );
      for (const [key] of matches) {
        parsedContents.scopes[scopeName][key] = parsedContents.scopes[
          scopeName
        ][key].replace(searchString, newString);
        newFileContent = replaceAsString(
          parsedContents,
          newFileContent ?? fileContent,
          depType,
          searchString,
          newString,
        );
      }
    }
  }

  return newFileContent;
}

export function updateDependency(
  config: UpdateDependencyConfig<DenoManagerData>,
): string | null {
  const { fileContent, upgrade } = config;
  const {
    depName,
    currentValue,
    newValue,
    datasource,
    packageFile,
    managerData,
  } = upgrade;
  if (!packageFile) {
    logger.debug('deno.updateDependency(): No package file found');
    return null;
  }

  // <importMap>.json
  if (managerData?.importMapReferrer) {
    if (!depName || !newValue || !datasource || !upgrade.depType) {
      logger.debug({ depName, currentValue, newValue }, 'Unknown value');
      return null;
    }
    const depType = upgrade.depType;
    logger.debug(
      `deno.updateDependency(): ${packageFile}:${depType}.${depName} = ${newValue}`,
    );

    const parsedResult = UpdateImportMapJsonFile.safeParse(fileContent);
    if (!parsedResult.success) {
      logger.debug(
        { err: parsedResult.error },
        `Invalid packageFile: ${packageFile} detected`,
      );
      return null;
    }
    const parsedContents = parsedResult.data;

    const searchCurrentValue = getValueByDatasource(
      datasource,
      depName,
      currentValue,
    );
    const newString = getValueByDatasource(datasource, depName, newValue);
    if (!searchCurrentValue || !newString) {
      logger.debug(
        `deno.updateDependency(): "${datasource}" is not supported datasource`,
      );
      return null;
    }

    return updateImportMapLikeDepTypes(
      parsedContents,
      fileContent,
      depType,
      searchCurrentValue,
      newString,
    );
  }

  // deno.json/jsonc
  if (upath.basename(packageFile).startsWith('deno.json')) {
    if (!depName || !newValue || !datasource || !upgrade.depType) {
      logger.debug({ depName, currentValue, newValue }, 'Unknown value');
      return null;
    }
    const depType = upgrade.depType;
    logger.debug(
      `deno.updateDependency(): ${packageFile}:${depType}.${depName} = ${newValue}`,
    );

    const parsedResult = UpdateDenoJsonFile.safeParse(fileContent);
    if (!parsedResult.success) {
      logger.debug(
        { err: parsedResult.error },
        `Invalid packageFile: ${packageFile} detected`,
      );
      return null;
    }
    const parsedContents = parsedResult.data;

    let newFileContent: string | null = null;

    const searchCurrentValue = getValueByDatasource(
      datasource,
      depName,
      currentValue,
    );
    const newString = getValueByDatasource(datasource, depName, newValue);
    if (!searchCurrentValue || !newString) {
      logger.debug(
        `deno.updateDependency(): "${datasource}" is not supported datasource`,
      );
      return null;
    }

    newFileContent = updateImportMapLikeDepTypes(
      parsedContents,
      fileContent,
      depType,
      searchCurrentValue,
      newString,
    );

    if (depType === 'tasks' && parsedContents.tasks) {
      const matches = Object.entries(parsedContents.tasks).filter(
        ([, value]) => {
          if (typeof value === 'string') {
            return value.includes(searchCurrentValue);
          }
          return false;
        },
      );
      for (const [key, value] of matches) {
        if (typeof value === 'string') {
          // prettier-ignore
          parsedContents.tasks[key] = (parsedContents.tasks[key] as string).replace(searchCurrentValue, newString);
        }
        newFileContent = replaceAsString(
          parsedContents,
          newFileContent ?? fileContent,
          depType,
          searchCurrentValue,
          newString,
        );
      }
    }

    if (depType === 'tasks.command' && parsedContents.tasks) {
      const matches = Object.entries(parsedContents.tasks).filter(
        ([, value]) => {
          if (value && typeof value === 'object' && 'command' in value) {
            return value.command?.includes(searchCurrentValue);
          }
          return false;
        },
      );
      for (const [key, value] of matches) {
        if (value && typeof value === 'object' && 'command' in value) {
          // prettier-ignore
          (parsedContents.tasks[key] as { command: string }).command =
            (parsedContents.tasks[key] as { command: string }).command.replace(searchCurrentValue, newString);
        }
        newFileContent = replaceAsString(
          parsedContents,
          newFileContent ?? fileContent,
          depType,
          searchCurrentValue,
          newString,
        );
      }
    }

    if (
      depType === 'compilerOptions.types' &&
      is.nonEmptyArray(parsedContents.compilerOptions?.types)
    ) {
      const index = parsedContents.compilerOptions.types.findIndex(
        (value: string) => value === searchCurrentValue,
      );
      if (index !== -1) {
        parsedContents.compilerOptions.types[index] =
          // prettier-ignore
          parsedContents.compilerOptions.types[index].replace(searchCurrentValue, newString);
        newFileContent = replaceAsString(
          parsedContents,
          newFileContent ?? fileContent,
          depType,
          searchCurrentValue,
          newString,
        );
      }
    }

    if (
      depType === 'compilerOptions.jsxImportSource' &&
      parsedContents.compilerOptions?.jsxImportSource
    ) {
      parsedContents.compilerOptions.jsxImportSource =
        parsedContents.compilerOptions.jsxImportSource.replace(
          searchCurrentValue,
          newString,
        );
      newFileContent = replaceAsString(
        parsedContents,
        newFileContent ?? fileContent,
        depType,
        searchCurrentValue,
        newString,
      );
    }

    if (
      depType === 'compilerOptions.jsxImportSourceTypes' &&
      parsedContents.compilerOptions?.jsxImportSourceTypes
    ) {
      parsedContents.compilerOptions.jsxImportSourceTypes =
        parsedContents.compilerOptions.jsxImportSourceTypes.replace(
          searchCurrentValue,
          newString,
        );
      newFileContent = replaceAsString(
        parsedContents,
        newFileContent ?? fileContent,
        depType,
        searchCurrentValue,
        newString,
      );
    }

    if (
      depType === 'lint.plugins' &&
      is.nonEmptyArray(parsedContents.lint?.plugins)
    ) {
      const index = parsedContents.lint.plugins.findIndex(
        (value: string) => value === searchCurrentValue,
      );
      if (index !== -1) {
        parsedContents.lint.plugins[index] = parsedContents.lint.plugins[
          index
        ].replace(searchCurrentValue, newString);
        newFileContent = replaceAsString(
          parsedContents,
          newFileContent ?? fileContent,
          depType,
          searchCurrentValue,
          newString,
        );
      }
    }

    if (newFileContent === fileContent) {
      return fileContent;
    }
    return newFileContent;
  }

  // node-compat
  if (upath.basename(packageFile) === 'package.json') {
    return npmUpdateDependency(config);
  }

  logger.debug(`${packageFile} is not supported`);
  return null;
}
