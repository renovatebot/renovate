#!/usr/bin/env node

const fs = require('fs-extra');
const { validateConfig } = require('../dist/config/validation');
const { massageConfig } = require('../dist/config/massage');
const { getConfig } = require('../dist/config/file');
const { configFileNames } = require('../dist/config/app-strings');

/* eslint-disable no-console */

let returnVal = 0;

async function validate(desc, config, isPreset = false) {
  const res = await validateConfig(massageConfig(config), isPreset);
  if (res.errors.length) {
    console.log(
      `${desc} contains errors:\n\n${JSON.stringify(res.errors, null, 2)}`
    );
    returnVal = 1;
  }
  if (res.warnings.length) {
    console.log(
      `${desc} contains warnings:\n\n${JSON.stringify(res.warnings, null, 2)}`
    );
    returnVal = 1;
  }
}

(async () => {
  for (const file of configFileNames.filter(
    (name) => name !== 'package.json'
  )) {
    try {
      const rawContent = fs.readFileSync(file, 'utf8');
      console.log(`Validating ${file}`);
      try {
        const jsonContent = JSON.parse(rawContent);
        await validate(file, jsonContent);
      } catch (err) {
        console.log(`${file} is not valid Renovate config`);
        returnVal = 1;
      }
    } catch (err) {
      // file does not exist
    }
  }
  try {
    const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (pkgJson.renovate) {
      console.log(`Validating package.json > renovate`);
      await validate('package.json > renovate', pkgJson.renovate);
    }
    if (pkgJson['renovate-config']) {
      console.log(`Validating package.json > renovate-config`);
      for (const presetConfig of Object.values(pkgJson['renovate-config'])) {
        await validate('package.json > renovate-config', presetConfig, true);
      }
    }
  } catch (err) {
    // ignore
  }
  try {
    const fileConfig = getConfig(process.env);
    console.log(`Validating config.js`);
    try {
      await validate('config.js', fileConfig);
    } catch (err) {
      console.log(`config.js is not valid Renovate config`);
      returnVal = 1;
    }
  } catch (err) {
    // ignore
  }
  if (returnVal !== 0) {
    process.exit(returnVal);
  }
  console.log('OK');
})();
