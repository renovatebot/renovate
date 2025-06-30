import type { CustomDatasourceFormats } from '../../../../config/types';
import { HtmlFetcher } from './html';
import { JSONFetcher } from './json';
import { PlainFetcher } from './plain';
import { TomlFetcher } from './toml';
import type { CustomDatasourceFetcher } from './types';
import { YamlFetcher } from './yaml';

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
