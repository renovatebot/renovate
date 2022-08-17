import { logger } from '../../../logger';
import { escapeRegExp, regEx } from '../../../util/regex';
import type { UpdateDependencyConfig } from '../types';

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { managerData, newValue } = upgrade;

  const depName: string = managerData?.key || upgrade.depName;

  const gemMatchRegex = regEx(
    `^(?<header>\\s*gem\\s+['"]${escapeRegExp(
      depName
    )}['"])(?:(?<delimiter>\\s*,\\s*)(?<currentValue>['"][^'"]+['"](?:\\s*,\\s*['"][^'"]+['"])*))?`,
    'gm'
  );

  logger.debug(
    `bundler.updateDependency(): ${depName} = ${newValue ?? 'undefined'}`
  );
  try {
    const newContent = fileContent.replace(
      gemMatchRegex,
      // eslint-disable-next-line @typescript-eslint/no-inferrable-types
      (text, header: string, delimiter: string = ', ') => {
        const quoteMatch = text.match(regEx(/["']/));
        const quote = quoteMatch ? quoteMatch[0] : "'";
        const versions = newValue!
          .split(regEx(/\s*,\s*/))
          .map((range) => `${delimiter}${quote}${range}${quote}`)
          .join('');
        return `${header}${versions}`;
      }
    );
    return newContent;
  } catch (err) {
    // istanbul ignore next
    logger.debug({ err }, 'updateDependency error');
    return null;
  }
}
