import {
  allowedFields,
  exposedConfigOptions,
} from '../../dist/util/template/index.js';
import { readFile, updateFile } from '../utils/index.js';
import { replaceContent } from './utils.js';

export async function generateTemplates() {
  let exposedConfigOptionsText =
    'The following configuration options are passed through for templating: ';
  exposedConfigOptionsText +=
    exposedConfigOptions
      .map(
        (field) => `[${field}](/configuration-options/#${field.toLowerCase()})`
      )
      .join(', ') + '.';

  let runtimeText =
    'The following runtime values are passed through for templating: \n\n';
  for (const [field, description] of Object.entries(allowedFields)) {
    runtimeText += ` - \`${field}\`: ${description}\n`;
  }
  runtimeText += '\n\n';

  let templateContent = await readFile('../usage/templates.md');
  templateContent = replaceContent(templateContent, exposedConfigOptionsText);
  templateContent = replaceContent(templateContent, runtimeText);
  await updateFile('./docs/templates.md', templateContent);
}
