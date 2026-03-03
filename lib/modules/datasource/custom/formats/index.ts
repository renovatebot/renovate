import type { CustomDatasourceFormats } from '../../../../config/types.ts';
import { HtmlFetcher } from './html.ts';
import { JSONFetcher } from './json.ts';
import { PlainFetcher } from './plain.ts';
import { TomlFetcher } from './toml.ts';
import type { CustomDatasourceFetcher } from './types.ts';
import { YamlFetcher } from './yaml.ts';

export const fetchers: Record<
  CustomDatasourceFormats,
  CustomDatasourceFetcher
> = {
  html: new HtmlFetcher(),
  json: new JSONFetcher(),
  plain: new PlainFetcher(),
  toml: new TomlFetcher(),
  yaml: new YamlFetcher(),
};
