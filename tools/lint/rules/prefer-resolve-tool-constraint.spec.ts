import { RuleTester } from 'oxlint/plugins-dev';
import rule from './prefer-resolve-tool-constraint.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('prefer-resolve-tool-constraint', rule, {
  valid: [
    // the helper is the intended way to read a constraint
    `const python = await resolveToolConstraint(config, 'python');`,
    `const python = await resolveToolConstraint(config, 'python', () => derive());`,
    // extraction populates the same properties on package files
    `packageFile.extractedConstraints ??= {};\npackageFile.extractedConstraints.golang = version;`,
    `res.extractedConstraints = { php: require.php };`,
    `if (p.extractedConstraints) {\n  subPackage.extractedConstraints = { ...p.extractedConstraints };\n}`,
    // writes to the config are not reads
    `config.constraints = {};`,
    `config.extractedConstraints ??= {};`,
    // other properties of the config
    `const { deps, lockFiles } = config;`,
    `const value = config.isLockFileMaintenance;`,
    // `constraints` on something that is not the config
    `coerceObject(config.data.constraints);`,
    `const { constraints } = lock;`,
    `const current = lock.constraints;`,
    `function f({ constraints }: Lock) {}`,
    `const f = ({ constraints }: TerraformLock): string => constraints;`,
    // computed access is not a property read of the config
    `const value = config[key];`,
  ],
  invalid: [
    {
      code: `const python = config.constraints?.python;`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    {
      code: `const python = config.constraints.python;`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    {
      code: `const python = config?.constraints?.python;`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    {
      code: `const python = config!.constraints!.python;`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    {
      code: `const python = config.extractedConstraints?.python;`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    {
      code: `const bun = updateArtifact.config.constraints?.bun;`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    {
      code: `const bun = updateArtifact?.config?.constraints?.bun;`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    {
      code: `const node = postUpdateConfig.constraints?.node;`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    {
      code: `const node = (config as PostUpdateConfig).constraints?.node;`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    // passing the whole record on is still a read
    {
      code: `const tools = getToolConstraints(config.constraints, safeMode);`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    {
      code: `const merged = { ...config.extractedConstraints, ...config.constraints };`,
      errors: [
        { messageId: 'preferResolveToolConstraint' },
        { messageId: 'preferResolveToolConstraint' },
      ],
    },
    // destructuring the config
    {
      code: `const { constraints } = config;`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    {
      code: `const { constraints = {} } = config;`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    {
      code: `const { constraints, extractedConstraints } = config;`,
      errors: [
        { messageId: 'preferResolveToolConstraint' },
        { messageId: 'preferResolveToolConstraint' },
      ],
    },
    {
      code: `const { constraints } = updateArtifact.config;`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    {
      code: `function f({ constraints }: UpdateArtifactsConfig) {}`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    {
      code: `function f({ constraints }: Partial<PostUpdateConfig>) {}`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    {
      code: `function f({ constraints }: PostUpdateConfig | undefined = {}) {}`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    {
      code: `export async function updateArtifacts({ config: { constraints, isLockFileMaintenance }, packageFileName }: UpdateArtifact) {}`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
    {
      code: `const f = ({ constraints }) => constraints;`,
      errors: [{ messageId: 'preferResolveToolConstraint' }],
    },
  ],
});
