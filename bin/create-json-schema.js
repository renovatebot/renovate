const fs = require('fs');
const { getOptions } = require('../lib/config/definitions');

const types = {
  list: 'array',
  json: 'object',
  object: 'object',
  integer: 'integer',
  string: 'string',
  boolean: 'boolean',
};

const schema = {
  title: 'JSON schema for Renovate config files (https://renovatebot.com/)',
  $schema: 'http://json-schema.org/draft-04/schema#',
  type: 'object',
  properties: {},
};
const options = getOptions();
const properties = {};

function createSingleConfig(option) {
  const temp = {};
  temp.type = types[option.type];
  if (temp.type === 'object') {
    temp.$ref = '#';
  }
  if (temp.type === 'array' && option.subType) {
    temp.items = {
      type: types[option.subType],
    };
  }
  if (option.format) {
    temp.format = option.format;
  }
  if (option.description) {
    temp.description = option.description;
  }
  if (option.default) {
    temp.default = option.default;
  }
  if (option.allowedValues) {
    temp.enum = option.allowedValues;
  }
  return temp;
}

function createSchemaForParentConfigs() {
  for (const option of options) {
    if (!option.parent) {
      properties[option.name] = createSingleConfig(option);
    }
  }
}

function addChildrenArrayInParents() {
  for (const option of options) {
    if (option.parent) {
      properties[option.parent].items = {
        allOf: [
          {
            type: 'object',
            properties: {},
          },
        ],
      };
    }
  }
}

function createSchemaForChildConfigs() {
  for (const option of options) {
    if (option.parent) {
      properties[option.parent].items.allOf[0].properties[
        option.name
      ] = createSingleConfig(option);
    }
  }
}

function generateSchema() {
  createSchemaForParentConfigs();
  addChildrenArrayInParents();
  createSchemaForChildConfigs();
  schema.properties = properties;
  fs.writeFileSync(
    'renovate-schema.json',
    JSON.stringify(schema, null, 2),
    'utf-8'
  );
}

generateSchema();
