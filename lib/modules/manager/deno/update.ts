import is from '@sindresorhus/is';
import { dequal } from 'dequal';
import upath from 'upath';
import { logger } from '../../../logger';
import { parseJsonc } from '../../../util/common';
import { matchAt, replaceAt } from '../../../util/string';
import { updateDependency as npmUpdateDependency } from '../npm';
import type { UpdateDependencyConfig } from '../types';
import type { DenoJsonFile, DepTypes, ImportMapJsonFile } from './schema';
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

function replaceAsString(
  parsedContents: DenoJsonFile,
  fileContent: string,
  depType: keyof DepTypes,
  searchString: string,
  newString: string,
): string | null {
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
  }
  // this string searching could match more than once
  // when the test case in "updates dependency in compilerOptions"
  // so we returns null instead of throwing an error like
  // the same name function in lib/modules/manager/npm/update/dependency/index.ts
  return null;
}

function updateImportMapLikeDepTypes(
  parsedContents: ImportMapJsonFile | DenoJsonFile,
  fileContent: string,
  depType: keyof ImportMapJsonFile | DenoJsonFile,
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
      const result = replaceAsString(
        parsedContents,
        fileContent,
        depType,
        searchString,
        newString,
      );
      if (result) {
        newFileContent = result;
      }
    }
  }

  if (depType === 'scopes' && parsedContents.scopes) {
    for (const scopeName of Object.keys(parsedContents.scopes)) {
      const matches = Object.entries(parsedContents.scopes[scopeName]).filter(
        ([, value]) => value.includes(searchString),
      );
      for (const [key] of matches) {
        parsedContents.scopes[scopeName][key] = parsedContents.scopes[
          scopeName
        ][key].replace(searchString, newString);
        const result = replaceAsString(
          parsedContents,
          newFileContent ?? fileContent,
          depType,
          searchString,
          newString,
        );
        if (result) {
          newFileContent = result;
        }
      }
    }
  }

  return newFileContent;
}

export function updateDependency(
  config: UpdateDependencyConfig<DenoManagerData>,
): string | null {
  const { fileContent, upgrade } = config;
  const { depName, currentValue, newValue, datasource, packageFile } = upgrade;
  if (!packageFile) {
    logger.debug('deno.updateDependency(): No package file found');
    return null;
  }

  // <importMap>.json
  if (
    depName === 'imports' ||
    depName === 'scopes' ||
    (upath.basename(packageFile).endsWith('.json') &&
      !upath.basename(packageFile).startsWith('deno.json') &&
      upath.basename(packageFile) !== 'package.json')
  ) {
    if (!depName || !newValue || !datasource || !upgrade.depType) {
      logger.debug({ depName, currentValue, newValue }, 'Unknown value');
      return null;
    }
    const depType = upgrade.depType as keyof ImportMapJsonFile;
    logger.debug(
      `deno.updateDependency(): ${packageFile}:${depType}.${depName} = ${newValue}`,
    );

    let parsedContents: ImportMapJsonFile;
    try {
      parsedContents = JSON.parse(fileContent) as ImportMapJsonFile;
    } catch (err) {
      logger.debug({ err }, `Invalid packageFile: ${packageFile} detected`);
      return null;
    }

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
    const depType = upgrade.depType as keyof DepTypes;
    logger.debug(
      `deno.updateDependency(): ${packageFile}:${depType}.${depName} = ${newValue}`,
    );

    let parsedContents: DenoJsonFile;
    try {
      parsedContents = parseJsonc(fileContent) as DenoJsonFile;
    } catch (err) {
      logger.debug({ err }, `Invalid packageFile: ${packageFile} detected`);
      return null;
    }

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
      depType as ImportMapJsonFile, // down cast
      searchCurrentValue,
      newString,
    );

    if (depType === 'tasks' && parsedContents.tasks) {
      const matches = Object.entries(parsedContents.tasks).filter(
        ([, value]) => {
          if (typeof value === 'string') {
            return value.includes(searchCurrentValue);
          } else {
            return (
              'command' in value && value.command?.includes(searchCurrentValue)
            );
          }
        },
      );
      for (const [key, value] of matches) {
        if (typeof value === 'string') {
          // prettier-ignore
          parsedContents.tasks[key] = (parsedContents.tasks[key] as string).replace(
              searchCurrentValue,
              newString,
            );
        } else {
          // prettier-ignore
          (parsedContents.tasks[key] as { command: string }).command = (parsedContents.tasks[key] as { command: string })
              .command.replace(searchCurrentValue, newString);
        }
        const result = replaceAsString(
          parsedContents,
          newFileContent ?? fileContent,
          depType,
          searchCurrentValue,
          newString,
        );
        if (result) {
          newFileContent = result;
        }
      }
    }

    if (depType === 'compilerOptions' && parsedContents.compilerOptions) {
      if (
        'types' in parsedContents.compilerOptions &&
        is.nonEmptyArray(parsedContents.compilerOptions.types)
      ) {
        const index = parsedContents.compilerOptions.types.findIndex(
          (value) => value === searchCurrentValue,
        );
        if (index !== -1) {
          parsedContents.compilerOptions.types[index] =
            parsedContents.compilerOptions.types[index].replace(
              searchCurrentValue,
              newString,
            );
          const result = replaceAsString(
            parsedContents,
            newFileContent ?? fileContent,
            depType,
            searchCurrentValue,
            newString,
          );
          if (result) {
            newFileContent = result;
          }
        }
      }

      if (
        'jsxImportSource' in parsedContents.compilerOptions &&
        parsedContents.compilerOptions.jsxImportSource
      ) {
        parsedContents.compilerOptions.jsxImportSource =
          parsedContents.compilerOptions.jsxImportSource.replace(
            searchCurrentValue,
            newString,
          );
        const result = replaceAsString(
          parsedContents,
          newFileContent ?? fileContent,
          depType,
          searchCurrentValue,
          newString,
        );
        if (result) {
          newFileContent = result;
        }
      }

      if (
        'jsxImportSourceTypes' in parsedContents.compilerOptions &&
        parsedContents.compilerOptions.jsxImportSourceTypes
      ) {
        parsedContents.compilerOptions.jsxImportSourceTypes =
          parsedContents.compilerOptions.jsxImportSourceTypes.replace(
            searchCurrentValue,
            newString,
          );
        const result = replaceAsString(
          parsedContents,
          newFileContent ?? fileContent,
          depType,
          searchCurrentValue,
          newString,
        );
        if (result) {
          newFileContent = result;
        }
      }
    }

    if (depType === 'lint' && parsedContents.lint) {
      if ('plugins' in parsedContents.lint && parsedContents.lint.plugins) {
        const index = parsedContents.lint.plugins.findIndex(
          (value) => value === searchCurrentValue,
        );
        if (index !== -1) {
          parsedContents.lint.plugins[index] = parsedContents.lint.plugins[
            index
          ].replace(searchCurrentValue, newString);
          const result = replaceAsString(
            parsedContents,
            newFileContent ?? fileContent,
            depType,
            searchCurrentValue,
            newString,
          );
          if (result) {
            newFileContent = result;
          }
        }
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
