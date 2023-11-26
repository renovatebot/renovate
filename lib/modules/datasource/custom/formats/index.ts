import type { CustomDatasourceFormats } from '../../../../config/types';
import { JSONFetcher } from './json';
import { PlainFetcher } from './plain';
import type { CustomDatasourceFetcher } from './types';
import { YamlFetcher } from './yaml';

export const fetchers: Record<
  CustomDatasourceFormats,
  CustomDatasourceFetcher
> = {
  json: new JSONFetcher(),
  plain: new PlainFetcher(),
  yaml: new YamlFetcher(),
};
