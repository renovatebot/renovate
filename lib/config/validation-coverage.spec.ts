import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getOptions } from './options/index.ts';
import type {
  AllConfig,
  RenovateConfig,
  RenovateOptions,
  ValidationMessage,
} from './types.ts';
import { validateConfig } from './validation.ts';

type CheckOutcome = 'pass' | 'fail' | 'crashes' | 'n/a';

interface OptionResult {
  name: string;
  type: RenovateOptions['type'];
  parents?: string[];
  globalOnly?: boolean;
  hasAllowedValues: boolean;
  supportsTemplating?: boolean;
  checks: {
    recognized: CheckOutcome;
    rejectsWrongType: CheckOutcome;
    enforcesAllowedValues: CheckOutcome;
    enforcesParent: CheckOutcome;
    enforcesGlobalOnly: CheckOutcome;
    enforcesTemplating: CheckOutcome;
  };
  notes: string[];
}

const allOptions = getOptions();
const optionsByName = new Map<string, RenovateOptions>(
  allOptions.map((o) => [o.name, o]),
);

const ARRAY_PARENTS = new Set<string>([
  'packageRules',
  'hostRules',
  'bumpVersions',
  'customManagers',
  'logLevelRemap',
]);

const FREE_CHOICE_PARENTS = new Set<string>([
  'customDatasources',
  'installTools',
  'toolSettings',
]);

function sampleValue(option: RenovateOptions): unknown {
  if (option.default !== undefined && option.default !== null) {
    return option.default;
  }
  if (option.allowedValues?.length) {
    const first = option.allowedValues[0];
    return option.type === 'array' ? [first] : first;
  }
  switch (option.type) {
    case 'string':
      return 'sample';
    case 'integer':
      return 1;
    case 'boolean':
      return true;
    case 'array':
      return option.subType === 'number' ? [1] : [];
    case 'object':
      return {};
  }
}

function wrongTypeValue(option: RenovateOptions): unknown {
  switch (option.type) {
    case 'boolean':
      return 'not-a-boolean';
    case 'integer':
      return 'not-an-integer';
    case 'string':
      return 12345;
    case 'array':
      return 'not-an-array';
    case 'object':
      return 'not-an-object';
  }
}

function buildConfigForOption(
  option: RenovateOptions,
  value: unknown,
  forceTopLevel = false,
): { config: RenovateConfig; configType: 'global' | 'repo' } {
  const configType: 'global' | 'repo' = option.globalOnly ? 'global' : 'repo';
  const parents = option.parents;

  if (forceTopLevel || !parents?.length || parents.includes('.')) {
    return { config: { [option.name]: value } as RenovateConfig, configType };
  }

  const parentName = parents.find((p) => p !== '.') ?? parents[0];
  const parentOption = optionsByName.get(parentName);

  if (ARRAY_PARENTS.has(parentName) || parentOption?.type === 'array') {
    return {
      config: { [parentName]: [{ [option.name]: value }] } as RenovateConfig,
      configType,
    };
  }
  if (FREE_CHOICE_PARENTS.has(parentName) || parentOption?.freeChoice) {
    return {
      config: {
        [parentName]: { _sample: { [option.name]: value } },
      } as RenovateConfig,
      configType,
    };
  }
  return {
    config: { [parentName]: { [option.name]: value } } as RenovateConfig,
    configType,
  };
}

function isUnrecognizedFor(option: string, msg: ValidationMessage): boolean {
  if (msg.topic !== 'Configuration Error') {
    return false;
  }
  if (!msg.message.startsWith('Invalid configuration option:')) {
    return false;
  }
  return (
    msg.message
      .replace('Invalid configuration option:', '')
      .trim()
      .split('.')
      .pop() === option
  );
}

const TYPE_REJECTION_PHRASES = [
  'should be boolean',
  'should be a boolean',
  'should be a string',
  'should be a list',
  'should be a json object',
  'should be a JSON object',
  'should be an integer',
  'should be a positive integer',
  'should be a number',
  'must be a string',
  'must be an integer',
];

function mentionsOption(
  option: RenovateOptions,
  msg: ValidationMessage,
): boolean {
  return msg.message.includes(option.name);
}

function hasPhrase(msg: ValidationMessage, phrases: string[]): boolean {
  return phrases.some((p) => msg.message.includes(p));
}

const PARENT_REJECTION_PHRASES = ["can't be used in"];
const GLOBAL_ONLY_PHRASES = [
  'is a global option reserved',
  'global option reserved',
];
const ALLOWED_VALUES_PHRASES = [
  'Invalid value',
  'is not allowed',
  'allowed values',
  'allowedValues',
];
const TEMPLATE_PHRASES = ['Invalid template in config path'];

describe('config/validation-coverage', () => {
  const results = new Map<string, OptionResult>();

  function testsAllowedValues(o: RenovateOptions): boolean {
    return (
      !!o.allowedValues?.length &&
      (o.type === 'string' || (o.type === 'array' && o.subType === 'string'))
    );
  }

  function testsTemplating(o: RenovateOptions): boolean {
    return (
      !!o.supportsTemplating &&
      (o.type === 'string' || (o.type === 'array' && o.subType === 'string'))
    );
  }

  function testsParent(o: RenovateOptions): boolean {
    return !!o.parents?.length && !o.parents.includes('.');
  }

  // Pre-populate so afterAll always reports every option, even on skip
  for (const option of allOptions) {
    results.set(option.name, {
      name: option.name,
      type: option.type,
      parents: option.parents as string[] | undefined,
      globalOnly: option.globalOnly,
      hasAllowedValues: !!option.allowedValues?.length,
      supportsTemplating: option.supportsTemplating,
      checks: {
        recognized: 'n/a',
        rejectsWrongType: 'n/a',
        enforcesAllowedValues: testsAllowedValues(option) ? 'fail' : 'n/a',
        enforcesParent: testsParent(option) ? 'fail' : 'n/a',
        enforcesGlobalOnly: option.globalOnly ? 'fail' : 'n/a',
        enforcesTemplating: testsTemplating(option) ? 'fail' : 'n/a',
      },
      notes: [],
    });
  }

  // ---------- 1. Recognized when given a valid value ----------
  describe('option is recognized when given a valid value', () => {
    it.each(allOptions.map((o) => [o.name, o] as const))(
      '"%s"',
      async (_name, option) => {
        const result = results.get(option.name)!;
        const value = sampleValue(option);
        const { config, configType } = buildConfigForOption(option, value);
        try {
          const { errors } = await validateConfig(
            configType,
            config as AllConfig,
          );
          const unrecognized = errors.some((e) =>
            isUnrecognizedFor(option.name, e),
          );
          result.checks.recognized = unrecognized ? 'fail' : 'pass';
        } catch (err) {
          result.checks.recognized = 'crashes';
          result.notes.push(`recognized: ${(err as Error).message}`);
        }
      },
    );
  });

  // ---------- 2. Rejects wrong-typed value ----------
  describe('option rejects a wrong-typed value', () => {
    it.each(allOptions.map((o) => [o.name, o] as const))(
      '"%s"',
      async (_name, option) => {
        const result = results.get(option.name)!;
        const value = wrongTypeValue(option);
        const { config, configType } = buildConfigForOption(option, value);
        try {
          const { errors, warnings } = await validateConfig(
            configType,
            config as AllConfig,
          );
          const msgs = [...errors, ...warnings];
          const rejected = msgs.some(
            (m) =>
              mentionsOption(option, m) && hasPhrase(m, TYPE_REJECTION_PHRASES),
          );
          result.checks.rejectsWrongType = rejected ? 'pass' : 'fail';
        } catch (err) {
          result.checks.rejectsWrongType = 'crashes';
          result.notes.push(`rejectsWrongType: ${(err as Error).message}`);
        }
      },
    );
  });

  // ---------- 3. Enforces allowedValues ----------
  const allowedValueOptions = allOptions.filter(testsAllowedValues);
  describe('option enforces allowedValues', () => {
    it.each(allowedValueOptions.map((o) => [o.name, o] as const))(
      '"%s"',
      async (_name, option) => {
        const result = results.get(option.name)!;
        const bad = '__not_in_allowed_values__';
        const value = option.type === 'array' ? [bad] : bad;
        const { config, configType } = buildConfigForOption(option, value);
        try {
          const { errors, warnings } = await validateConfig(
            configType,
            config as AllConfig,
          );
          const msgs = [...errors, ...warnings];
          const rejected = msgs.some(
            (m) =>
              mentionsOption(option, m) && hasPhrase(m, ALLOWED_VALUES_PHRASES),
          );
          result.checks.enforcesAllowedValues = rejected ? 'pass' : 'fail';
        } catch (err) {
          result.checks.enforcesAllowedValues = 'crashes';
          result.notes.push(`enforcesAllowedValues: ${(err as Error).message}`);
        }
      },
    );
  });

  // ---------- 4. Enforces parent scope ----------
  const parentedOptions = allOptions.filter(testsParent);
  describe('option enforces parent scope', () => {
    it.each(parentedOptions.map((o) => [o.name, o] as const))(
      '"%s"',
      async (_name, option) => {
        const result = results.get(option.name)!;
        const value = sampleValue(option);
        // Force top-level placement to violate the parent contract
        const { config, configType } = buildConfigForOption(
          option,
          value,
          true,
        );
        try {
          const { errors, warnings } = await validateConfig(
            configType,
            config as AllConfig,
          );
          const msgs = [...errors, ...warnings];
          const rejected = msgs.some((m) =>
            hasPhrase(m, PARENT_REJECTION_PHRASES),
          );
          result.checks.enforcesParent = rejected ? 'pass' : 'fail';
        } catch (err) {
          result.checks.enforcesParent = 'crashes';
          result.notes.push(`enforcesParent: ${(err as Error).message}`);
        }
      },
    );
  });

  // ---------- 5. Enforces globalOnly in repo config ----------
  // Test ALL globalOnly options — even those with inheritConfigSupport should
  // produce a warning when used in 'repo' config (they're only permitted in
  // 'inherit'). See lib/config/validation.ts isGlobalOption handling.
  const globalOnlyOptions = allOptions.filter((o) => o.globalOnly);
  describe('option rejects globalOnly use in repo config', () => {
    it.each(globalOnlyOptions.map((o) => [o.name, o] as const))(
      '"%s"',
      async (_name, option) => {
        const result = results.get(option.name)!;
        const value = sampleValue(option);
        // Override configType to 'repo' for this check
        const { config } = buildConfigForOption(option, value);
        try {
          const { errors, warnings } = await validateConfig(
            'repo',
            config as AllConfig,
          );
          const msgs = [...errors, ...warnings];
          const rejected = msgs.some(
            (m) =>
              mentionsOption(option, m) && hasPhrase(m, GLOBAL_ONLY_PHRASES),
          );
          result.checks.enforcesGlobalOnly = rejected ? 'pass' : 'fail';
        } catch (err) {
          result.checks.enforcesGlobalOnly = 'crashes';
          result.notes.push(`enforcesGlobalOnly: ${(err as Error).message}`);
        }
      },
    );
  });

  // ---------- 6. Enforces supportsTemplating ----------
  const templatingOptions = allOptions.filter(testsTemplating);
  describe('option rejects invalid templates', () => {
    it.each(templatingOptions.map((o) => [o.name, o] as const))(
      '"%s"',
      async (_name, option) => {
        const result = results.get(option.name)!;
        const badTemplate = '{{ unclosed';
        const value = option.type === 'array' ? [badTemplate] : badTemplate;
        const { config, configType } = buildConfigForOption(option, value);
        try {
          const { errors } = await validateConfig(
            configType,
            config as AllConfig,
          );
          const rejected = errors.some((m) => hasPhrase(m, TEMPLATE_PHRASES));
          result.checks.enforcesTemplating = rejected ? 'pass' : 'fail';
        } catch (err) {
          result.checks.enforcesTemplating = 'crashes';
          result.notes.push(`enforcesTemplating: ${(err as Error).message}`);
        }
      },
    );
  });

  afterAll(async () => {
    const list = [...results.values()];
    const total = list.length;

    function dimensionStats(key: keyof OptionResult['checks']) {
      const applicable = list.filter((r) => r.checks[key] !== 'n/a');
      const pass = applicable.filter((r) => r.checks[key] === 'pass').length;
      const crashes = applicable.filter(
        (r) => r.checks[key] === 'crashes',
      ).length;
      const fail = applicable.length - pass - crashes;
      const pct =
        applicable.length > 0
          ? +((pass / applicable.length) * 100).toFixed(1)
          : 0;
      return { applicable: applicable.length, pass, fail, crashes, pct };
    }

    const dims = {
      recognized: dimensionStats('recognized'),
      rejectsWrongType: dimensionStats('rejectsWrongType'),
      enforcesAllowedValues: dimensionStats('enforcesAllowedValues'),
      enforcesParent: dimensionStats('enforcesParent'),
      enforcesGlobalOnly: dimensionStats('enforcesGlobalOnly'),
      enforcesTemplating: dimensionStats('enforcesTemplating'),
    };

    const summary = { total, dimensions: dims };

    const report = {
      summary,
      options: list.sort((a, b) => a.name.localeCompare(b.name)),
    };

    const reportDir = join(process.cwd(), 'tmp');
    await mkdir(reportDir, { recursive: true });
    await writeFile(
      join(reportDir, 'option-coverage.json'),
      JSON.stringify(report, null, 2),
    );

    function fmt(label: string, d: ReturnType<typeof dimensionStats>) {
      return `  ${label.padEnd(24)} ${String(d.pass).padStart(3)}/${String(d.applicable).padStart(3)} (${d.pct}%)  fail=${d.fail} crashes=${d.crashes}`;
    }

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        `[option-coverage] total options: ${total}`,
        fmt('recognized', dims.recognized),
        fmt('rejects wrong type', dims.rejectsWrongType),
        fmt('enforces allowedValues', dims.enforcesAllowedValues),
        fmt('enforces parent scope', dims.enforcesParent),
        fmt('enforces globalOnly', dims.enforcesGlobalOnly),
        fmt('enforces templating', dims.enforcesTemplating),
        '  report: tmp/option-coverage.json',
        '',
      ].join('\n'),
    );
  });

  it('records a result for every option', () => {
    expect(results.size).toBe(allOptions.length);
  });
});
