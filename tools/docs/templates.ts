import { getOptions } from '../../lib/config/options/index.ts';
import {
  allowedFields,
  exposedConfigOptions,
} from '../../lib/util/template/index.ts';
import { readFile, updateFile } from '../utils/index.ts';
import { replaceContent } from './utils.ts';

function getOptionLink(
  name: string,
  optionParentMap: Map<string, string>,
  optionGlobalOnly: Set<string>,
): string {
  const parent = optionParentMap.get(name);
  const anchor = parent ? `${parent}${name}`.toLowerCase() : name.toLowerCase();
  const page = optionGlobalOnly.has(name)
    ? 'self-hosted-configuration.md'
    : 'configuration-options.md';
  return ` - [${name}](${page}#${anchor})`;
}

export async function generateTemplates(dist: string): Promise<void> {
  const options = getOptions();
  const optionParentMap = new Map(
    options
      .filter((o) => o.parents?.length)
      .map((o) => [o.name, o.parents![0]]),
  );
  const optionGlobalOnly = new Set(
    options.filter((o) => o.globalOnly).map((o) => o.name),
  );

  let exposedConfigOptionsText =
    'The following configuration options are passed through for templating: \n\n';
  exposedConfigOptionsText += exposedConfigOptions
    .map((field) => getOptionLink(field, optionParentMap, optionGlobalOnly))
    .join('\n');

  let runtimeText =
    'The following runtime values are passed through for templating: \n\n';
  for (const [field, description] of Object.entries(allowedFields)) {
    runtimeText += ` - \`${field}\`: ${description}\n`;
  }
  runtimeText += '\n\n';

  let supportsTemplatingText =
    'The following configuration options accept Handlebars template syntax in their values:\n';
  supportsTemplatingText += options
    .filter((o) => o.supportsTemplating)
    .map((o) => getOptionLink(o.name, optionParentMap, optionGlobalOnly))
    .join('\n');

  let templateContent = await readFile('docs/usage/templates.md');
  templateContent = replaceContent(templateContent, supportsTemplatingText, {
    replaceStart:
      '<!-- Automatically insert options that support templating here -->',
    replaceStop:
      '<!-- Automatically insert options that support templating end -->',
  });
  templateContent = replaceContent(templateContent, exposedConfigOptionsText);
  templateContent = replaceContent(templateContent, runtimeText);
  await updateFile(`${dist}/templates.md`, templateContent);
}
