import { z } from 'zod';
import datasources from './api';
import type { DatasourceApi } from './types';

export const Datasource = z
  .string()
  .transform((datasourceName, ctx): DatasourceApi => {
    const datasource = datasources.get(datasourceName);
    if (!datasource) {
      ctx.addIssue({
        code: 'custom',
        message: `Datasource: '${datasourceName}' not found`,
      });
      return z.NEVER;
    }

    return datasource;
  });
