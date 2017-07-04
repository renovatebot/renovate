#!/usr/bin/env node
const stringify = require('json-stringify-pretty-compact');

const definitions = require('../lib/config/definitions');
const defaultsParser = require('../lib/config/defaults');
const cliParser = require('../lib/config/cli');
const envParser = require('../lib/config/env');

/* eslint-disable no-console */
// Print table header
console.log('## Configuration Options');
console.log('');
console.log('<table>');
console.log('<tr>');
const columns = [
  'Name',
  'Description',
  'Type',
  'Default value',
  'Environment',
  'CLI',
];
columns.forEach(column => {
  console.log(`  <th>${column}</th>`);
});
console.log('</tr>');
const options = definitions.getOptions();
options.forEach(option => {
  let optionDefault = defaultsParser.getDefault(option);
  if (optionDefault !== '') {
    optionDefault = `<pre>${stringify(optionDefault)}</pre>`;
  }
  let envName = envParser.getEnvName(option);
  if (envName.length) {
    envName = `\`${envName}\``;
  }
  let cliName = cliParser.getCliName(option);
  if (cliName.length) {
    cliName = `\`${cliName}\``;
  }
  console.log(
    `<tr>
  <td>\`${option.name}\`</td>
  <td>${option.description}</td>
  <td>${option.type}</td>
  <td>${optionDefault}</td>
  <td>${envName}</td>
  <td>${cliName}<td>
</tr>`
  );
});
/* eslint-enable no-console */
