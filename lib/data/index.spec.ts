import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isPlainObject } from '@sindresorhus/is';

interface FileConfig {
  /** Top-level keys that must appear first, in the given order. */
  firstKeys?: string[];
}

const fileConfigs: Record<string, FileConfig> = {
  'abandonments.json': {},
  'changelog-urls.json': {},
  'monorepo.json': {},
  'replacements.json': { firstKeys: ['all'] },
  'source-urls.json': {},
};

const files = Object.keys(fileConfigs);

function checkKeysSorted(
  obj: Record<string, unknown>,
  path: string,
  depth: number,
  firstKeys?: string[],
): void {
  let keys = Object.keys(obj);
  if (depth === 0 && firstKeys?.length) {
    expect(
      keys.slice(0, firstKeys.length),
      `${path} should start with [${firstKeys.join(', ')}]`,
    ).toStrictEqual(firstKeys);
    keys = keys.slice(firstKeys.length);
  }
  expect(keys, `${path} keys should be sorted alphabetically`).toStrictEqual(
    [...keys].sort(),
  );
  for (const [key, value] of Object.entries(obj)) {
    if (isPlainObject(value)) {
      checkKeysSorted(value, `${path}.${key}`, depth + 1);
    }
  }
}

describe('data/index', () => {
  for (const file of files) {
    describe(`${file}`, () => {
      let data: Record<string, unknown>;

      beforeAll(async () => {
        data = JSON.parse(
          await readFile(join(import.meta.dirname, file), 'utf8'),
        ) as Record<string, unknown>;
      });

      it('keys are sorted alphabetically', () => {
        const { firstKeys } = fileConfigs[file];
        const root = Object.fromEntries(
          Object.entries(data).filter(([k]) => k !== '$schema'),
        );
        checkKeysSorted(root, file, 0, firstKeys);
      });
    });
  }
});
