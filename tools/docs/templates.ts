import { getOptions } from '../../lib/config/options/index.ts';
import {
  allowedFields,
  exposedConfigOptions,
} from '../../lib/util/template/index.ts';
import { readFile, updateFile } from '../utils/index.ts';
import { replaceContent } from './utils.ts';

export async function generateTemplates(dist: string): Promise<void> {
  const options = getOptions();
  const optionParentMap = new Map(
    options
      .filter((o) => o.parents?.length)
      .map((o) => [o.name, o.parents![0]]),
  );

  let exposedConfigOptionsText =
    'The following configuration options are passed through for templating: \n\n';
  exposedConfigOptionsText += exposedConfigOptions
    .map((field) => {
      const parent = optionParentMap.get(field);
      const anchor = parent
        ? `${parent}${field}`.toLowerCase()
        : field.toLowerCase();
      return ` - [${field}](configuration-options.md#${anchor})`;
    })
    .join('\n');

  let runtimeText =
    'The following runtime values are passed through for templating: \n\n';
  for (const [field, description] of Object.entries(allowedFields)) {
    runtimeText += ` - \`${field}\`: ${description}\n`;
  }
  runtimeText += '\n\n';

  let templateContent = await readFile('docs/usage/templates.md');
  templateContent = replaceContent(templateContent, exposedConfigOptionsText);
  templateContent = replaceContent(templateContent, runtimeText);
  await updateFile(`${dist}/templates.md`, templateContent);
}
