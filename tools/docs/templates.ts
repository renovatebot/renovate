import { allowedFields, exposedConfigOptions } from '../../lib/util/template';
import { readFile, updateFile } from '../utils';
import { replaceContent } from './utils';

export async function generateTemplates(dist: string): Promise<void> {
  let exposedConfigOptionsText =
    'The following configuration options are passed through for templating: ';
  exposedConfigOptionsText +=
    exposedConfigOptions
      .map(
        (field) =>
          `[${field}](configuration-options.md#${field.toLowerCase()})`,
      )
      .join(', ') + '.';

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
