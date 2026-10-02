import { isPlainObject } from '@sindresorhus/is';
import { getOptions } from '../../lib/config/options/index.ts';
import { getAllowedParents } from '../../lib/config/options/scopes.ts';
import type {
  AllowedParents,
  RenovateOptions,
  RenovateRequiredOption,
} from '../../lib/config/types.ts';
import { pkg } from '../../lib/expose.ts';
import { hasKey } from '../../lib/util/object.ts';
import { updateFile } from '../utils/index.ts';
import { readDocsHeadings } from './utils.ts';

type JsonSchemaBasicType =
  'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
type JsonSchemaType = JsonSchemaBasicType | JsonSchemaBasicType[];

/* These are sorted in priority order, but editors may not suggest in that order */
const presetsToSuggest = [
  'config:best-practices',
  'config:recommended',
  'mergeConfidence:all-badges',
  'abandonments:recommended',
  'group:all',
  'replacements:all',
  'security:minimumReleaseAgeNpm',
  'security:only-security-updates',
];

const docsPages = {
  repo: 'configuration-options',
  global: 'self-hosted-configuration',
} as const;

export type DocsHeadings = Record<keyof typeof docsPages, Set<string>>;

export async function readAllDocsHeadings(): Promise<DocsHeadings> {
  return {
    repo: await readDocsHeadings(`${docsPages.repo}.md`),
    global: await readDocsHeadings(`${docsPages.global}.md`),
  };
}

/**
 * An option is documented under a single heading, which is either top-level or below one of its `parents`, so we can only link to it by finding the heading which exists.
 */
function getOptionDocsHeading(
  option: RenovateOptions,
  headings: Set<string>,
): string {
  if (headings.has(option.name)) {
    return option.name;
  }

  const parents = option.parents?.filter((parent) => parent !== '.') ?? [];
  const documentedChild = parents
    .map((parent) => `${parent}.${option.name}`)
    .find((heading) => headings.has(heading));
  if (documentedChild) {
    return documentedChild;
  }

  /* options which have no heading of their own, like the per-manager ones, are documented elsewhere */
  return parents.length ? `${parents[0]}.${option.name}` : option.name;
}

export function getOptionDocsUrl(
  option: RenovateOptions,
  headings: DocsHeadings,
): string {
  const scope = option.globalOnly ? 'global' : 'repo';
  const anchor = getOptionDocsHeading(option, headings[scope])
    .replaceAll('.', '')
    .toLowerCase();

  return `https://docs.renovatebot.com/${docsPages[scope]}/#${anchor}`;
}

/**
 * When suggesting presets in `extends`, suggest a number of values that users may want to use
 */
function createExtendsSchema(items: Record<string, any>): any[] {
  return [
    {
      type: 'array',
      items: {
        anyOf: [
          {
            enum: presetsToSuggest,
          },
          items,
        ],
      },
    },
    { ...items },
  ];
}

function createSingleConfig(
  option: RenovateOptions,
  headings: DocsHeadings,
): Record<string, unknown> {
  const temp: Record<string, any> & {
    type?: JsonSchemaType;
  } & Omit<Partial<RenovateOptions>, 'type'> = {};
  if (option.description) {
    const docsUrl = getOptionDocsUrl(option, headings);
    temp.description = `${option.description}\nSee also: ${docsUrl}`;
    temp.markdownDescription = `${option.description}\n\nSee also: [${option.name}](${docsUrl})`;
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
        if (option.allowString) {
          temp.items.anyOf = [
            { enum: option.allowedValues },
            { type: 'string' },
          ];
        } else {
          temp.items.enum = option.allowedValues;
        }
      } else if (option.suggestedValues) {
        /* the values are a suggestion rather than the only ones allowed, so anything of the right type is still valid */
        temp.items.anyOf = [
          { enum: option.suggestedValues },
          { type: option.subType },
        ];
      }
    }
    if (option.subType === 'string' && option.allowString === true) {
      const items = temp.items;
      delete temp.items;
      delete temp.type;
      if (option.name === 'extends') {
        temp.oneOf = createExtendsSchema(items);
      } else {
        temp.oneOf = [{ type: 'array', items }, { ...items }];
      }
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
      if (option.allowString || option.supportsTemplating) {
        temp.anyOf = [{ enum: option.allowedValues }, { type: 'string' }];
      } else {
        temp.enum = option.allowedValues;
      }
    }
  }
  if (option.default !== undefined) {
    temp.default = option.default;
  }
  if (
    hasKey('additionalProperties', option) &&
    option.additionalProperties !== undefined
  ) {
    /* the option's metadata is frozen, so we need our own copy to be able to declare any children on it */
    temp.additionalProperties = isPlainObject(option.additionalProperties)
      ? { ...option.additionalProperties }
      : option.additionalProperties;
  }
  if (hasKey('properties', option) && option.properties !== undefined) {
    /* the option's metadata is frozen, so we need our own copy to be able to declare any children on it */
    temp.properties = { ...option.properties };
  }
  if (option.default === null || option.nullable) {
    temp.type = [option.type, 'null'];
  }
  if (
    (temp.type === 'object' || temp.type?.includes('object')) &&
    !option.freeChoice &&
    /* an option which describes the shape of its own values, like a map of strings, doesn't nest a Renovate config */
    temp.additionalProperties === undefined
  ) {
    temp.$ref = '#';
  }

  if (option.name === 'repositories') {
    temp.items = {
      oneOf: [
        { type: 'string' },
        {
          allOf: [
            {
              type: 'object',
              required: ['repository'],
              properties: {
                repository: {
                  type: 'string',
                  minLength: 1,
                  description: 'Repository name (e.g. `owner/repo`).',
                },
              },
            },
            { $ref: '#' },
          ],
        },
      ],
    };
  }

  return temp;
}

function createSchemaForParentConfigs(
  options: RenovateOptions[],
  properties: Record<string, any>,
  definitions: Record<string, any>,
): void {
  for (const option of options) {
    const parents = getAllowedParents(option);
    if (!parents || parents.includes('.')) {
      properties[option.name] = { $ref: `#/definitions/${option.name}` };
    }
  }
}

/**
 * The objects an option can be used in, other than the top level of a config.
 */
function getNestedParents(option: RenovateOptions): AllowedParents[] {
  return (getAllowedParents(option) ?? []).filter((parent) => parent !== '.');
}

/**
 * The schema which a parent's children are declared on, which differs depending on whether the parent is an array of configs, a map of configs, or a config itself.
 */
function getChildrenSchema(
  definition: Record<string, any>,
): Record<string, any> {
  const type: JsonSchemaType | undefined = definition.type;
  if (type === 'array' || (Array.isArray(type) && type.includes('array'))) {
    definition.items ??= {};
    return definition.items;
  }

  /* a map of configs declares its children on its values, rather than on the map itself */
  if (isPlainObject(definition.additionalProperties)) {
    return definition.additionalProperties;
  }

  return definition;
}

function addChildrenToParents(
  options: RenovateOptions[],
  properties: Record<string, any>,
  definitions: Record<string, any>,
): void {
  for (const option of options) {
    for (const parent of getNestedParents(option)) {
      getChildrenSchema(definitions[parent]).allOf = [
        {
          type: 'object',
          properties: {},
        },
      ];
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
    // oxlint-disable-next-line unicorn/no-thenable -- JSON Schema if/then/else pattern
    then: {
      required: [option.name],
    },
  };
}

function createSchemaForChildConfigs(
  options: RenovateOptions[],
  properties: Record<string, any>,
  definitions: Record<string, any>,
): void {
  for (const option of options) {
    for (const parent of getNestedParents(option)) {
      {
        const children = getChildrenSchema(definitions[parent]);
        children.allOf[0].properties[option.name] = {
          $ref: `#/definitions/${option.name}`,
        };

        for (const prop of option.requiredIf ?? []) {
          children.allOf.push(toRequiredPropertiesRule(prop, option));
        }
      }
    }
  }
}

interface BuildSchemaOpts {
  version?: string;
  isInherit?: boolean;
  isGlobal?: boolean;
}

interface GenerateSchemaOpts extends BuildSchemaOpts {
  filename?: string;
}

export async function buildSchema({
  version = pkg.version,
  isInherit = false,
  isGlobal = false,
}: BuildSchemaOpts = {}): Promise<Record<string, any>> {
  if (isInherit && isGlobal) {
    throw new Error(
      'Generating schema for both `isInherit` and `isGlobal` is not supported. Only use one',
    );
  }

  const schema = {
    // may be overridden based on `isGlobal` and `isInherit`
    $id: 'https://docs.renovatebot.com/renovate-schema.json',
    title: `JSON schema for Renovate ${version} config files (https://renovatebot.com/)`,
    $schema: 'http://json-schema.org/draft-07/schema#',
    'x-renovate-version': `${version}`,
    allowComments: true,
    type: 'object',
    definitions: {} as Record<string, any>,
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
    schema.$id = 'https://docs.renovatebot.com/renovate-global-schema.json';
    schema.title = `JSON schema for Renovate ${version} global self-hosting configuration (https://renovatebot.com/)`;
  } else if (isInherit) {
    schema.$id = 'https://docs.renovatebot.com/renovate-inherited-schema.json';
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
  const definitions = schema.definitions;
  const headings = await readAllDocsHeadings();
  for (const option of configurationOptions) {
    definitions[option.name] = createSingleConfig(option, headings);
  }

  const properties = schema.properties as Record<string, any>;

  createSchemaForParentConfigs(configurationOptions, properties, definitions);
  addChildrenToParents(configurationOptions, properties, definitions);
  createSchemaForChildConfigs(configurationOptions, properties, definitions);

  return schema;
}

export async function generateSchema(
  dist: string,
  { filename = 'renovate-schema.json', ...opts }: GenerateSchemaOpts = {},
): Promise<void> {
  const schema = await buildSchema(opts);

  await updateFile(
    `${dist}/${filename}`,
    `${JSON.stringify(schema, null, 2)}\n`,
  );
}
