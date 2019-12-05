const handlebars = require('handlebars');
const { logger } = require('../../../logger');

function getTableDefinition(config) {
  const res = [];
  for (const header of config.prBodyColumns) {
    const value = config.prBodyDefinitions[header];
    res.push({ header, value });
  }
  return res;
}

function getNonEmptyColumns(definitions, rows) {
  const res = [];
  for (const column of definitions) {
    const { header } = column;
    for (const row of rows) {
      if (row[header] && row[header].length) {
        if (!res.includes(header)) {
          res.push(header);
        }
      }
    }
  }
  return res;
}

export function getPrUpdatesTable(config) {
  const tableDefinitions = getTableDefinition(config);
  const tableValues = config.upgrades.map(upgrade => {
    const res = {};
    for (const column of tableDefinitions) {
      const { header, value } = column;
      try {
        // istanbul ignore else
        if (value) {
          res[header] = handlebars
            .compile(value)(upgrade)
            .replace(/^``$/, '');
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
      val += ` ${row[column].replace(/^@/, '@&#8203;')} |`;
    }
    val += '\n';
    rows.push(val);
  }
  const uniqueRows = [...new Set(rows)];
  res += uniqueRows.join('');
  res += '\n\n';
  return res;
}
