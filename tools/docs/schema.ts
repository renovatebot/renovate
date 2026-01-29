import { getOptions } from '../../lib/config/options/index.ts';
import type {
  RenovateOptions,
  RenovateRequiredOption,
} from '../../lib/config/types.ts';
import { pkg } from '../../lib/expose.ts';
import { hasKey } from '../../lib/util/object.ts';
import { updateFile } from '../utils/index.ts';

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
  isInherit?: boolean;
  isGlobal?: boolean;
}

export async function generateSchema(
  dist: string,
  {
    filename = 'renovate-schema.json',
    version = pkg.version,
    isInherit = false,
    isGlobal = false,
  }: GenerateSchemaOpts = {},
): Promise<void> {
  if (isInherit && isGlobal) {
    throw new Error(
      'Generating schema for both `isInherit` and `isGlobal` is not supported. Only use one',
    );
  }

  const schema = {
    // may be overridden based on `isGlobal` and `isInherit`
    title: `JSON schema for Renovate ${version} config files (https://renovatebot.com/)`,
    $schema: 'http://json-schema.org/draft-07/schema#',
    'x-renovate-version': `${version}`,
    allowComments: true,
    type: 'object',
    properties: {},

    /* any configuration items that should not be set - only used in inherited or repo config */
    not: undefined as
      | {
          /* we have to use `anyOf` here with each rule, so any of the properties can be found in isolation, and will be excluded */
          anyOf: {
            required: string[];
          }[];
        }
      | undefined,
  };

  if (isGlobal) {
    schema.title = `JSON schema for Renovate ${version} global self-hosting configuration (https://renovatebot.com/)`;
  } else if (isInherit) {
    schema.title = `JSON schema for Renovate ${version} config files (with Inherit Config options) (https://renovatebot.com/)`;
  }

  const configurationOptions = getOptions().filter((o) => {
    // always allow non-global options
    if (!o.globalOnly) {
      return true;
    }

    if (o.globalOnly && o.inheritConfigSupport) {
      const allowed = isInherit || isGlobal;
      if (!allowed) {
        schema.not ??= {
          anyOf: [],
        };
        // we have to use `anyOf` here with each rule, so any of the properties can be found in isolation, and will be excluded
        schema.not.anyOf.push({
          required: [o.name],
        });
      }
      return isInherit || isGlobal;
    }

    if (o.globalOnly) {
      if (!isGlobal) {
        schema.not ??= {
          anyOf: [],
        };
        // we have to use `anyOf` here with each rule, so any of the properties can be found in isolation, and will be excluded
        schema.not.anyOf.push({
          required: [o.name],
        });
      }
      return isGlobal;
    }

    // we don't currently have any config options that are hitting this, but to be safe, let's throw an error if we ever hit this
    throw new Error(`Unhandled case for \`${o.name}\``);
  });

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
