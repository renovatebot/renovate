#!/usr/bin/env node
const stringify = require('json-stringify-pretty-compact');

const definitions = require('../src/config/definitions');
const defaultsParser = require('../src/config/defaults');
const cliParser = require('../src/config/cli');
const envParser = require('../src/config/env');

/* eslint-disable no-console */
// Print table header
console.log('## Configuration Options');
console.log('');
console.log('| Name | Description | Type | Default value | Environment | CLI |');
console.log('|------|-------------|------|---------------|-------------|-----|');

const options = definitions.getOptions();
options.forEach((option) => {
  let optionDefault = defaultsParser.getDefault(option);
  if (optionDefault !== '') {
    optionDefault = `\`${stringify(optionDefault)}\``;
  }
  let envName = envParser.getEnvName(option);
  if (envName.length) {
    envName = `\`${envName}\``;
  }
  let cliName = cliParser.getCliName(option);
  if (cliName.length) {
    cliName = `\`${cliName}\``;
  }
  console.log(`| \`${option.name}\` | ${option.description} | ${option.type} | ${optionDefault} | ${envName} | ${cliName} |`);
});
/* eslint-enable no-console */
