const fs = require('fs');
const upath = require('upath');
const { getOptions } = require('../lib/config/definitions');

const schema = {
  title: 'JSON schema for Renovate config files (https://renovatebot.com/)',
  $schema: 'http://json-schema.org/draft-04/schema#',
  type: 'object',
  properties: {},
};
const options = getOptions();
options.sort((a, b) => {
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return 0;
});
const properties = {};

function createSingleConfig(option) {
  const temp = {};
  if (option.description) {
    temp.description = option.description;
  }
  temp.type = option.type;
  if (temp.type === 'array') {
    if (option.subType) {
      temp.items = {
        type: option.subType,
      };
      if (option.format) {
        temp.items.format = option.format;
      }
      if (option.allowedValues) {
        temp.items.enum = option.allowedValues;
      }
    }
    if (option.subType == 'string' && option.allowString === true) {
      const items = temp.items;
      delete temp.items;
      delete temp.type;
      temp.oneOf = [{ type: 'array', items }, { ...items }];
    }
  } else {
    if (option.format) {
      temp.format = option.format;
    }
    if (option.allowedValues) {
      temp.enum = option.allowedValues;
    }
  }
  if (option.default !== undefined) {
    temp.default = option.default;
  }
  if (option.additionalProperties !== undefined) {
    temp.additionalProperties = option.additionalProperties;
  }
  if (temp.type === 'object' && !option.freeChoice) {
    temp.$ref = '#';
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
    upath.join(__dirname, '../renovate-schema.json'),
    JSON.stringify(schema, null, 2),
    'utf-8'
  );
}

generateSchema();
