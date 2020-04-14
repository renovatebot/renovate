import _ from 'lodash';
import yaml from 'js-yaml';
import is from '@sindresorhus/is';

import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';
import { matchAt, replaceAt } from '../../util/string';

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string {
  logger.trace({ config: upgrade }, 'updateDependency()');
  if (!upgrade || !upgrade.depName || !upgrade.newValue) {
    logger.debug('Failed to update dependency, invalid upgrade');
    return fileContent;
  }
  const doc = yaml.safeLoad(fileContent, { json: true });
  if (!doc || !is.array(doc.releases)) {
    logger.debug('Failed to update dependency, invalid helmfile.yaml file');
    return fileContent;
  }
  const { depName, newValue } = upgrade;
  const oldVersion = doc.releases.filter(
    (dep) => dep.chart.split('/')[1] === depName
  )[0].version;
  doc.releases = doc.releases.map((dep) =>
    dep.chart.split('/')[1] === depName ? { ...dep, version: newValue } : dep
  );
  const searchString = `${oldVersion}`;
  const newString = `${newValue}`;
  let newFileContent = fileContent;

  let searchIndex = newFileContent.indexOf('releases') + 'releases'.length;
  for (; searchIndex < newFileContent.length; searchIndex += 1) {
    // First check if we have a hit for the old version
    if (matchAt(newFileContent, searchIndex, searchString)) {
      logger.trace(`Found match at index ${searchIndex}`);
      // Now test if the result matches
      newFileContent = replaceAt(
        newFileContent,
        searchIndex,
        searchString,
        newString
      );
    }
  }
  // Compare the parsed yaml structure of old and new
  if (!_.isEqual(doc, yaml.safeLoad(newFileContent, { json: true }))) {
    logger.trace(`Mismatched replace: ${newFileContent}`);
    newFileContent = fileContent;
  }

  return newFileContent;
}
