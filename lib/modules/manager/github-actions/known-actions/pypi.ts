import { PypiDatasource } from '../../../datasource/pypi/index.ts';
import type { KnownActionConfig } from '../types.ts';
import { valSchema } from './utils.ts';

export const pypiActions: Record<string, KnownActionConfig> = {
  // https://github.com/abatilo/actions-poetry
  'abatilo/actions-poetry': {
    datasource: PypiDatasource.id,
    packageName: 'poetry',
    withSchema: valSchema('poetry-version'),
  },
  'pdm-project/setup-pdm': {
    datasource: PypiDatasource.id,
    packageName: 'pdm',
  },
  // https://github.com/PyO3/maturin-action
  'PyO3/maturin-action': {
    datasource: PypiDatasource.id,
    packageName: 'maturin',
    withSchema: valSchema('maturin-version'),
  },
  // https://github.com/snok/install-poetry
  'snok/install-poetry': {
    datasource: PypiDatasource.id,
    packageName: 'poetry',
  },
};
