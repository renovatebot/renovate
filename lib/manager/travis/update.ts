import is from '@sindresorhus/is';
import detectIndent from 'detect-indent';
import { UpdateDependencyConfig } from '../common';
import { logger } from '../../logger';

export function updateDependency({
  fileContent,
  updateOptions,
}: UpdateDependencyConfig): string | null {
  try {
    logger.debug(`travis.updateDependency(): ${updateOptions.newValue}`);
    const indent = detectIndent(fileContent).indent || '  ';
    let quote: string;
    if (is.string(updateOptions.currentValue[0])) {
      quote =
        fileContent.split(`'`).length > fileContent.split(`"`).length
          ? `'`
          : `"`;
    } else {
      quote = '';
    }
    let newString = `node_js:\n`;
    // TODO: `newValue` is a string!
    (updateOptions.newValue as any).forEach(version => {
      newString += `${indent}- ${quote}${version}${quote}\n`;
    });
    return fileContent.replace(/node_js:(\n\s+-[^\n]+)+\n/, newString);
  } catch (err) {
    logger.info({ err }, 'Error setting new .travis.yml node versions');
    return null;
  }
}
