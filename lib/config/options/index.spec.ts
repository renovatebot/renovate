import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { isNullOrUndefined } from '@sindresorhus/is';
import * as manager from '../../modules/manager/index.ts';
import * as platform from '../../modules/platform/index.ts';
import { getOptions } from './index.ts';

vi.unmock('../../modules/platform/index.ts');

async function collectTsFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectTsFiles(fullPath)));
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.includes('.spec.') &&
      !entry.name.includes('.test.')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('config/options/index', () => {
  it('test manager should have no defaultConfig', () => {
    vi.doMock('../../modules/manager/index.ts', () => ({
      getManagers: vi.fn(() => new Map().set('testManager', {})),
    }));

    const opts = getOptions();
    expect(opts.filter((o) => o.name === 'testManager')).toEqual([]);
  });

  it('supportedManagers should have valid names', () => {
    const opts = getOptions();
    const managerList = Array.from(manager.getManagers().keys());

    opts
      .filter((option) => option.supportedManagers)
      .forEach((option) => {
        expect(option.supportedManagers).toBeNonEmptyArray();
        for (const item of option.supportedManagers!) {
          expect(managerList).toContain(item);
        }
      });
  });

  it('supportedPlatforms should have valid names', () => {
    const opts = getOptions();
    const platformList = Array.from(platform.getPlatformList());

    opts
      .filter((option) => option.supportedPlatforms)
      .forEach((option) => {
        expect(option.supportedPlatforms).toBeNonEmptyArray();
        for (const item of option.supportedPlatforms!) {
          expect(platformList).toContain(item);
        }
      });
  });

  it('should not contain duplicate option names', () => {
    const optsNames = getOptions().map((option) => option.name);
    const optsNameSet = new Set(optsNames);
    expect(optsNames).toHaveLength(optsNameSet.size);
  });

  describe('every option with allowedValues and a default must have the default in allowedValues', () => {
    const opts = getOptions();
    for (const option of opts.filter(
      (o) => o.allowedValues && !isNullOrUndefined(o.default),
    )) {
      it(`${option.name}: \`${option.default}\` is in ${JSON.stringify(option.allowedValues)}`, () => {
        expect(option.allowedValues).toBeDefined();

        const defaults = Array.isArray(option.default)
          ? option.default
          : [option.default];
        for (const defVal of defaults) {
          expect(option.allowedValues).toContain(defVal);
        }
      });
    }
  });

  describe('supportsTemplating options', () => {
    const opts = getOptions().filter((option) => option.supportsTemplating);

    for (const option of opts) {
      it(`${option.name} should be of type string or array of strings`, () => {
        const valid =
          option.type === 'string' ||
          (option.type === 'array' && option.subType === 'string');
        expect(valid).toBeTrue();
      });
    }
  });

  describe('template.compile usage must have supportsTemplating', async () => {
    const allOptions = getOptions();
    const supportsTemplating = new Set(
      allOptions.filter((o) => o.supportsTemplating).map((o) => o.name),
    );

    // Scan source files for template.compile(config.xxx, ...) and compile(config.xxx, ...) patterns
    const sourceDir = join(__dirname, '..', '..');
    const sourceFiles = (
      await Promise.all([
        collectTsFiles(join(sourceDir, 'workers')),
        collectTsFiles(join(sourceDir, 'modules', 'datasource', 'custom')),
        collectTsFiles(join(sourceDir, 'modules', 'manager', 'custom')),
        collectTsFiles(join(sourceDir, 'util', 'package-rules')),
      ])
    ).flat();

    const directPattern =
      /(?<![.\w])(?:template\.)?compile\(\s*(?:config|update|upgrade|upg|toApply)\??\.(\w+)/g;
    const detectedOptions = new Set<string>();

    for (const file of sourceFiles) {
      const content = await readFile(file, 'utf-8');
      let match;
      while ((match = directPattern.exec(content)) !== null) {
        const name = match[1];
        const option = allOptions.find((o) => o.name === name);
        // Only include string or array-of-string options (not objects like userStrings)
        if (
          option &&
          (option.type === 'string' ||
            (option.type === 'array' && option.subType === 'string'))
        ) {
          detectedOptions.add(name);
        }
      }
    }

    // Options compiled via array iteration or intermediate variables
    // that cannot be detected by regex. Keep this list in sync manually.
    const indirectlyCompiled = [
      'labels', // labels.map(label => template.compile(label, ...))
      'addLabels', // same pattern as labels
      'prBodyNotes', // prBodyNotes.map(note => template.compile(note, ...))
      'commands', // postUpgradeTasks.commands iterated and compiled
      'filePatterns', // bumpVersions.filePatterns iterated and compiled
    ];
    for (const name of indirectlyCompiled) {
      detectedOptions.add(name);
    }

    for (const name of detectedOptions) {
      it(`${name} should have supportsTemplating: true`, () => {
        expect(supportsTemplating).toContain(name);
      });
    }
  });

  describe('every option with a siblingProperties has a `property` that matches a known option', () => {
    const opts = getOptions();
    const optionNames = new Set(opts.map((o) => o.name));

    for (const option of opts.filter((o) => o.requiredIf)) {
      for (const req of option.requiredIf!) {
        for (const prop of req.siblingProperties) {
          it(`${option.name}'s reference to ${prop.property} is valid`, () => {
            expect(optionNames).toContain(prop.property);
          });

          const foundOption = opts.filter((o) => o.name === prop.property);
          // oxlint-disable-next-line vitest/no-conditional-tests -- TODO: fix me
          if (foundOption?.length && foundOption[0].allowedValues) {
            it(`${option.name}'s value for ${prop.property} is valid, according to allowedValues`, () => {
              expect(foundOption[0].allowedValues).toContain(prop.value);
            });
          }
        }
      }
    }
  });

  describe('every globalOnly option should have stage=global', () => {
    const opts = getOptions();
    for (const option of opts) {
      if (option.globalOnly) {
        it(`globalOnly option ${option.name} has stage=global`, () => {
          expect(option.stage).toEqual('global');
        });
      }
    }
  });

  describe('every stage=global option should have globalOnly', () => {
    const opts = getOptions();
    for (const option of opts) {
      if (option.stage && option.stage === 'global') {
        it(`stage=global option ${option.name} is globalOnly`, () => {
          expect(option.globalOnly).toBeTrue();
        });
      }
    }
  });
});
