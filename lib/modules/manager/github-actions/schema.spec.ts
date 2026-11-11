import { Ajv2020 } from 'ajv/dist/2020.js';
import { Fixtures } from '~test/fixtures.ts';
import { getConfig } from '../../../config/defaults.ts';
import schemaData from '../../../data/github-actions-lockfile.json' with { type: 'json' };
import { parseSingleYaml } from '../../../util/yaml.ts';
import { ActionsLockfile } from './schema.ts';

describe('modules/manager/github-actions/schema', () => {
  const fixture = Fixtures.get('actions.lock');

  it('tracks the schema used by the pinned CLI', () => {
    expect(schemaData.versions.cli).toBe(
      getConfig().constraints?.ghActionsLock,
    );

    for (const [version, schema] of Object.entries(schemaData.schemas)) {
      expect(schema.properties.version.const).toBe(version);
    }
    expect(Object.keys(schemaData.schemas)).toContain(
      schemaData.versions.schema,
    );
  });

  it('preserves the workflows contract across supported schemas', () => {
    for (const schema of Object.values(schemaData.schemas)) {
      expect(schema.additionalProperties).toBeFalse();
      expect(schema.required).toEqual(['version']);
      expect(schema.properties.workflows).toMatchObject({
        type: 'object',
        additionalProperties: {
          type: 'array',
          items: { $ref: '#/$defs/pin' },
        },
      });
    }
  });

  it('validates the lockfile fixture with JSON Schema 2020-12', () => {
    const ajv = new Ajv2020({ strict: true });
    for (const schema of Object.values(schemaData.schemas)) {
      ajv.addSchema(schema);
    }

    const lockfile = parseSingleYaml<{ version: string }>(fixture);
    expect(lockfile.version).toBe(schemaData.versions.schema);
    const schema =
      schemaData.schemas[
        schemaData.versions.schema as keyof typeof schemaData.schemas
      ];
    expect(ajv.validate(schema.$id, lockfile)).toBeTrue();
  });

  it('keeps the runtime parser loose but deliberately requires workflows', () => {
    expect(
      ActionsLockfile.safeParse(`version: '${schemaData.versions.schema}'`)
        .success,
    ).toBeFalse();
    expect(
      ActionsLockfile.safeParse('workflows: {}\nfuture-field: true').success,
    ).toBeTrue();
  });
});
