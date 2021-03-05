import { logger } from '../../../logger';
import * as template from '../../../util/template';
import type { BranchConfig } from '../../types';

type TableDefinition = {
  header: string;
  value: string;
};

function getTableDefinition(config: BranchConfig): TableDefinition[] {
  const res: TableDefinition[] = [];
  for (const header of config.prBodyColumns) {
    const value = config.prBodyDefinitions[header];
    res.push({ header, value });
  }
  return res;
}

function getNonEmptyColumns(
  definitions: TableDefinition[],
  rows: Record<string, string>[]
): string[] {
  const res: string[] = [];
  for (const column of definitions) {
    const { header } = column;
    for (const row of rows) {
      if (row[header]?.length) {
        if (!res.includes(header)) {
          res.push(header);
        }
      }
    }
  }
  return res;
}

export function getPrUpdatesTable(config: BranchConfig): string {
  const tableDefinitions = getTableDefinition(config);
  const tableValues = config.upgrades.map((upgrade) => {
    const res: Record<string, string> = {};
    for (const column of tableDefinitions) {
      const { header, value } = column;
      try {
        // istanbul ignore else
        if (value) {
          res[header] = template.compile(value, upgrade).replace(/^``$/, '');
        } else {
          res[header] = '';
        }
      } catch (err) /* istanbul ignore next */ {
        logger.warn({ header, value, err }, 'Handlebars compilation error');
      }
    }
    return res;
  });
  const tableColumns = getNonEmptyColumns(tableDefinitions, tableValues);
  let res = '\n\nThis PR contains the following updates:\n\n';
  res += '| ' + tableColumns.join(' | ') + ' |\n';
  res += '|' + tableColumns.map(() => '---|').join('') + '\n';
  const rows = [];
  for (const row of tableValues) {
    let val = '|';
    for (const column of tableColumns) {
      const content = row[column]
        ? row[column].replace(/^@/, '@&#8203;').replace(/\|/g, '\\|')
        : '';
      val += ` ${content} |`;
    }
    val += '\n';
    rows.push(val);
  }
  const uniqueRows = [...new Set(rows)];
  res += uniqueRows.join('');
  res += '\n\n';
  return res;
}
