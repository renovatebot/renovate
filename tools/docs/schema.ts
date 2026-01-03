import { getOptions } from '../../lib/config/options';
import type {
  RenovateOptions,
  RenovateRequiredOption,
} from '../../lib/config/types';
import { pkg } from '../../lib/expose.cjs';
import { hasKey } from '../../lib/util/object';
import { updateFile } from '../utils';

type JsonSchemaBasicType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null';
type JsonSchemaType = JsonSchemaBasicType | JsonSchemaBasicType[];

function createSingleConfig(option: RenovateOptions): Record<string, unknown> {
  const temp: Record<string, any> & {
    type?: JsonSchemaType;
  } & Omit<Partial<RenovateOptions>, 'type'> = {};
  if (option.description) {
    temp.description = option.description;
  }
  temp.type = option.type;
  if (option.type === 'array') {
    if (option.subType) {
      temp.items = {
        type: option.subType,
      };
      if (hasKey('format', option) && option.format) {
        temp.items.format = option.format;
      }
      if (option.allowedValues) {
        temp.items.enum = option.allowedValues;
      }
    }
    if (option.subType === 'string' && option.allowString === true) {
      const items = temp.items;
      delete temp.items;
      delete temp.type;
      temp.oneOf = [{ type: 'array', items }, { ...items }];
    }
  } else {
    if (hasKey('format', option) && option.format) {
      temp.format = option.format;
    }
    if (option.name === 'versioning') {
      temp.oneOf = [
        { enum: option.allowedValues },
        { type: 'string', pattern: '^regex:' },
      ];
    } else if (option.allowedValues) {
      temp.enum = option.allowedValues;
    }
  }
  if (option.default !== undefined) {
    temp.default = option.default;
  }
  if (
    hasKey('additionalProperties', option) &&
    option.additionalProperties !== undefined
  ) {
    temp.additionalProperties = option.additionalProperties;
  }
  if (option.default === null) {
    temp.type = [option.type, 'null'];
  }
  if (
    (temp.type === 'object' || temp.type?.includes('object')) &&
    !option.freeChoice
  ) {
    temp.$ref = '#';
  }
  return temp;
}

function createSchemaForParentConfigs(
  options: RenovateOptions[],
  properties: Record<string, any>,
): void {
  for (const option of options) {
    if (!option.parents || option.parents.includes('.')) {
      properties[option.name] = createSingleConfig(option);
    }
  }
}

function addChildrenArrayInParents(
  options: RenovateOptions[],
  properties: Record<string, any>,
): void {
  for (const option of options) {
    if (option.parents) {
      for (const parent of option.parents.filter((parent) => parent !== '.')) {
        properties[parent].items = {
          allOf: [
            {
              type: 'object',
              properties: {
                description: {
                  oneOf: [
                    {
                      type: 'array',
                      items: {
                        type: 'string',
                        description:
                          'A custom description for this configuration object',
                      },
                    },
                    {
                      type: 'string',
                      description:
                        'A custom description for this configuration object',
                    },
                  ],
                },
              },
            },
          ],
        };
      }
    }
  }
}

function toRequiredPropertiesRule(
  prop: RenovateRequiredOption,
  option: RenovateOptions,
): Record<string, unknown> {
  const properties = {} as Record<string, any>;
  const required = [];
  for (const { property, value } of prop.siblingProperties) {
    properties[property] = { const: value };
    required.push(property);
  }
  return {
    if: {
      properties,
      required,
    },
    then: {
      required: [option.name],
    },
  };
}

function createSchemaForChildConfigs(
  options: RenovateOptions[],
  properties: Record<string, any>,
): void {
  for (const option of options) {
    if (option.parents) {
      for (const parent of option.parents.filter((parent) => parent !== '.')) {
        properties[parent].items.allOf[0].properties[option.name] =
          createSingleConfig(option);

        for (const prop of option.requiredIf ?? []) {
          properties[parent].items.allOf.push(
            toRequiredPropertiesRule(prop, option),
          );
        }
      }
    }
  }
}

interface GenerateSchemaOpts {
  filename?: string;
  version?: string;
  isGlobal?: boolean;
}

export async function generateSchema(
  dist: string,
  {
    filename = 'renovate-schema.json',
    version = pkg.version,
    isGlobal = false,
  }: GenerateSchemaOpts = {},
): Promise<void> {
  const schema = {
    title: isGlobal
      ? `JSON schema for Renovate ${version} global self-hosting configuration (https://renovatebot.com/)`
      : `JSON schema for Renovate ${version} config files (https://renovatebot.com/)`,
    $schema: 'http://json-schema.org/draft-07/schema#',
    'x-renovate-version': `${version}`,
    allowComments: true,
    type: 'object',
    properties: {},
  };
  const configurationOptions = getOptions();

  if (!isGlobal) {
    configurationOptions.map((v) => {
      // TODO #38728 remove any global-only options in the repository configuration schema
      if (v.globalOnly) {
        // NOTE that the JSON Schema version we're using does not have support for deprecating, so we need to use the `description` field
        v.description =
          "Deprecated: This configuration option is only intended to be used with 'global' configuration when self-hosting, not used in a repository configuration file. Renovate likely won't use the configuration, and these fields will be removed from the repository configuration documentation in Renovate v43 (https://github.com/renovatebot/renovate/issues/38728)\n\n" +
          v.description;
      }

      return v;
    });
  }

  configurationOptions.sort((a, b) => {
    if (a.name < b.name) {
      return -1;
    }
    if (a.name > b.name) {
      return 1;
    }
    return 0;
  });
  const properties = schema.properties as Record<string, any>;

  createSchemaForParentConfigs(configurationOptions, properties);
  addChildrenArrayInParents(configurationOptions, properties);
  createSchemaForChildConfigs(configurationOptions, properties);
  await updateFile(
    `${dist}/${filename}`,
    `${JSON.stringify(schema, null, 2)}\n`,
  );
}
