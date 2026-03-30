import { mockDeep } from 'vitest-mock-extended';
import { Fixtures } from '~test/fixtures.ts';
import { hostRules } from '~test/util.ts';
import { GoDatasource } from '../../datasource/go/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { extractPackageFile } from './index.ts';

vi.mock('../../../util/host-rules.ts', () => mockDeep());

const filename = 'prek.toml';

const validPrekConfig = Fixtures.get('valid.prek.toml');
const noReposPrekConfig = Fixtures.get('no_repos.prek.toml');
const missingRevPrekConfig = Fixtures.get('missing_rev.prek.toml');
const invalidUrlPrekConfig = Fixtures.get('invalid_url.prek.toml');
const enterprisePrekConfig = Fixtures.get('enterprise.prek.toml');
const additionalDependenciesPrekConfig = Fixtures.get(
  'additional_dependencies.prek.toml',
);
const malformedTypedRepoPrekConfig = Fixtures.get(
  'malformed_typed_repo.prek.toml',
);
const customGitlabHostPrekConfig = Fixtures.get('custom_gitlab_host.prek.toml');

describe('modules/manager/prek/extract', () => {
  beforeEach(() => {
    hostRules.find.mockReset();
    hostRules.hostType.mockReset();
  });

  describe('extractPackageFile()', () => {
    it('returns null for invalid TOML file content', () => {
      const result = extractPackageFile('not valid toml = [', filename);
      expect(result).toBeNull();
    });

    it('returns null for empty file content', () => {
      const result = extractPackageFile('', filename);
      expect(result).toBeNull();
    });

    it('returns null for no file content', () => {
      const result = extractPackageFile(null as never, filename);
      expect(result).toBeNull();
    });

    it('returns null when no repos are present', () => {
      const result = extractPackageFile(noReposPrekConfig, filename);
      expect(result).toBeNull();
    });

    it('returns null for empty repos', () => {
      const result = extractPackageFile('repos = []', filename);
      expect(result).toBeNull();
    });

    it('returns null when all repos are invalid', () => {
      const config = `[[repos]]
repo = "https://github.com/pre-commit/pre-commit-hooks"
revv = "v3.3.0"`;
      const result = extractPackageFile(config, filename);
      expect(result).toBeNull();
    });

    it('extracts supported remote repository dependencies and ignores local repos', () => {
      const result = extractPackageFile(validPrekConfig, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v5.0.0',
            datasource: 'github-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
          },
          {
            currentValue: '24.1.0',
            datasource: 'gitlab-tags',
            depName: 'psf/black',
            depType: 'repository',
            packageName: 'psf/black',
          },
          {
            currentValue: 'v2.1.2',
            datasource: 'github-tags',
            depName: 'prettier/pre-commit',
            depType: 'repository',
            packageName: 'prettier/pre-commit',
          },
          {
            currentValue: 'v2.4.0',
            datasource: 'github-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
          },
          {
            currentValue: 'v3.0.0',
            datasource: 'github-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
          },
        ],
      });
    });

    it('strips .git suffix from repository dependency depName', () => {
      const config = `[[repos]]
repo = "https://github.com/pre-commit/pre-commit-hooks.git"
rev = "v1.0.0"`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            datasource: 'github-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
          },
        ],
      });
    });

    it('normalizes depName when repository URL contains query and fragment', () => {
      const config = `[[repos]]
repo = "https://github.com/pre-commit/pre-commit-hooks.git?ref=main#frag"
rev = "v1.0.0"`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            datasource: 'github-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
          },
        ],
      });
    });

    it('normalizes depName for trailing slash repository URLs', () => {
      const config = `[[repos]]
repo = "https://github.com/pre-commit/pre-commit-hooks/"
rev = "v1.0.0"`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            datasource: 'github-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
          },
        ],
      });
    });

    it('extracts frozen SHA revs with double quotes', () => {
      const config = `[[repos]]
repo = "https://github.com/crate-ci/typos"
rev = "631208b7aac2daa8b707f55e7331f9112b0e062d" # frozen: v1.44.0
hooks = [{ id = "typos" }]`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '"{{#if newDigest}}{{newDigest}}"{{#if newValue}} # frozen: {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
            currentDigest: '631208b7aac2daa8b707f55e7331f9112b0e062d',
            currentValue: 'v1.44.0',
            datasource: 'github-tags',
            depName: 'crate-ci/typos',
            depType: 'repository',
            packageName: 'crate-ci/typos',
            replaceString:
              '"631208b7aac2daa8b707f55e7331f9112b0e062d" # frozen: v1.44.0',
          },
        ],
      });
    });

    it('extracts frozen SHA revs with single quotes', () => {
      const config = `[[repos]]
repo = "https://github.com/executablebooks/mdformat"
rev = '82912cdaea4fb830f751504486a7879c70526547' # frozen: 1.0.0

[[repos.hooks]]
id = "mdformat"`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              "'{{#if newDigest}}{{newDigest}}'{{#if newValue}} # frozen: {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}'{{/unless}}",
            currentDigest: '82912cdaea4fb830f751504486a7879c70526547',
            currentValue: '1.0.0',
            datasource: 'github-tags',
            depName: 'executablebooks/mdformat',
            depType: 'repository',
            packageName: 'executablebooks/mdformat',
            replaceString:
              "'82912cdaea4fb830f751504486a7879c70526547' # frozen: 1.0.0",
          },
        ],
      });
    });

    it('extracts frozen SHA revs when rev appears before repo in a repo block', () => {
      const config = `[[ repos ]]
rev = "631208b7aac2daa8b707f55e7331f9112b0e062d" # frozen: v1.44.0
repo = "https://github.com/crate-ci/typos"

[[repos]]
repo = "https://github.com/pre-commit/pre-commit-hooks"
rev = "v5.0.0"`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '"{{#if newDigest}}{{newDigest}}"{{#if newValue}} # frozen: {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
            currentDigest: '631208b7aac2daa8b707f55e7331f9112b0e062d',
            currentValue: 'v1.44.0',
            datasource: 'github-tags',
            depName: 'crate-ci/typos',
            depType: 'repository',
            packageName: 'crate-ci/typos',
            replaceString:
              '"631208b7aac2daa8b707f55e7331f9112b0e062d" # frozen: v1.44.0',
          },
          {
            currentValue: 'v5.0.0',
            datasource: 'github-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
          },
        ],
      });
    });

    it('extracts frozen SHA revs when repo line has a trailing comment', () => {
      const config = `[[repos]]
repo = "https://github.com/crate-ci/typos" # comment
rev = "631208b7aac2daa8b707f55e7331f9112b0e062d" # frozen: v1.44.0
hooks = [{ id = "typos" }]`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '"{{#if newDigest}}{{newDigest}}"{{#if newValue}} # frozen: {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
            currentDigest: '631208b7aac2daa8b707f55e7331f9112b0e062d',
            currentValue: 'v1.44.0',
            datasource: 'github-tags',
            depName: 'crate-ci/typos',
            depType: 'repository',
            packageName: 'crate-ci/typos',
            replaceString:
              '"631208b7aac2daa8b707f55e7331f9112b0e062d" # frozen: v1.44.0',
          },
        ],
      });
    });

    it('extracts frozen SHA revs when repo section line has a trailing comment', () => {
      const config = `[[repos]] # comment
rev = "631208b7aac2daa8b707f55e7331f9112b0e062d" # frozen: v1.44.0
repo = "https://github.com/crate-ci/typos"
hooks = [{ id = "typos" }]`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '"{{#if newDigest}}{{newDigest}}"{{#if newValue}} # frozen: {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
            currentDigest: '631208b7aac2daa8b707f55e7331f9112b0e062d',
            currentValue: 'v1.44.0',
            datasource: 'github-tags',
            depName: 'crate-ci/typos',
            depType: 'repository',
            packageName: 'crate-ci/typos',
            replaceString:
              '"631208b7aac2daa8b707f55e7331f9112b0e062d" # frozen: v1.44.0',
          },
        ],
      });
    });

    it('marks bare SHA revs as unspecified-version', () => {
      const config = `[[repos]]
repo = "https://github.com/python-jsonschema/check-jsonschema"
rev = "9f48a48aa91a6040d749ad68ec70907d907a5a7f"
hooks = [{ id = "check-metaschema" }]`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: '9f48a48aa91a6040d749ad68ec70907d907a5a7f',
            datasource: 'github-tags',
            depName: 'python-jsonschema/check-jsonschema',
            depType: 'repository',
            packageName: 'python-jsonschema/check-jsonschema',
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('extracts frozen SHA revs with trailing notes without consuming the note', () => {
      const config = `[[repos]]
repo = "https://github.com/crate-ci/typos"
rev = "631208b7aac2daa8b707f55e7331f9112b0e062d" # frozen: v1.44.0 # note
hooks = [{ id = "typos" }]`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '"{{#if newDigest}}{{newDigest}}"{{#if newValue}} # frozen: {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
            currentDigest: '631208b7aac2daa8b707f55e7331f9112b0e062d',
            currentValue: 'v1.44.0',
            datasource: 'github-tags',
            depName: 'crate-ci/typos',
            depType: 'repository',
            packageName: 'crate-ci/typos',
            replaceString:
              '"631208b7aac2daa8b707f55e7331f9112b0e062d" # frozen: v1.44.0',
          },
        ],
      });
    });

    it('extracts SHA revs with version comments as digest pins with currentValue', () => {
      const config = `[[repos]]
repo = "https://github.com/python-jsonschema/check-jsonschema"
rev = "9f48a48aa91a6040d749ad68ec70907d907a5a7f" # v1.2.3
hooks = [{ id = "check-metaschema" }]`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentDigest: '9f48a48aa91a6040d749ad68ec70907d907a5a7f',
            currentValue: 'v1.2.3',
            datasource: 'github-tags',
            depName: 'python-jsonschema/check-jsonschema',
            depType: 'repository',
            packageName: 'python-jsonschema/check-jsonschema',
            replaceString:
              '"9f48a48aa91a6040d749ad68ec70907d907a5a7f" # v1.2.3',
            autoReplaceStringTemplate:
              '"{{#if newDigest}}{{newDigest}}"{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
          },
        ],
      });
    });

    it('extracts SHA revs with plain numeric version comments as digest pins with currentValue', () => {
      const config = `[[repos]]
repo = "https://github.com/python-jsonschema/check-jsonschema"
rev = "9f48a48aa91a6040d749ad68ec70907d907a5a7f" # 1.2.3
hooks = [{ id = "check-metaschema" }]`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentDigest: '9f48a48aa91a6040d749ad68ec70907d907a5a7f',
            currentValue: '1.2.3',
            datasource: 'github-tags',
            depName: 'python-jsonschema/check-jsonschema',
            depType: 'repository',
            packageName: 'python-jsonschema/check-jsonschema',
            replaceString: '"9f48a48aa91a6040d749ad68ec70907d907a5a7f" # 1.2.3',
            autoReplaceStringTemplate:
              '"{{#if newDigest}}{{newDigest}}"{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
          },
        ],
      });
    });

    it('extracts SHA revs with pin-style version comments as digest pins with currentValue', () => {
      const config = `[[repos]]
repo = "https://github.com/python-jsonschema/check-jsonschema"
rev = "9f48a48aa91a6040d749ad68ec70907d907a5a7f" # pin @v1.2.3
hooks = [{ id = "check-metaschema" }]`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentDigest: '9f48a48aa91a6040d749ad68ec70907d907a5a7f',
            currentValue: 'v1.2.3',
            datasource: 'github-tags',
            depName: 'python-jsonschema/check-jsonschema',
            depType: 'repository',
            packageName: 'python-jsonschema/check-jsonschema',
            replaceString:
              '"9f48a48aa91a6040d749ad68ec70907d907a5a7f" # pin @v1.2.3',
            autoReplaceStringTemplate:
              '"{{#if newDigest}}{{newDigest}}"{{#if newValue}} # pin @{{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
          },
        ],
      });
    });

    it('extracts SHA revs with tag-style version comments as digest pins with currentValue', () => {
      const config = `[[repos]]
repo = "https://github.com/python-jsonschema/check-jsonschema"
rev = "9f48a48aa91a6040d749ad68ec70907d907a5a7f" # tag=v1.2.3
hooks = [{ id = "check-metaschema" }]`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentDigest: '9f48a48aa91a6040d749ad68ec70907d907a5a7f',
            currentValue: 'v1.2.3',
            datasource: 'github-tags',
            depName: 'python-jsonschema/check-jsonschema',
            depType: 'repository',
            packageName: 'python-jsonschema/check-jsonschema',
            replaceString:
              '"9f48a48aa91a6040d749ad68ec70907d907a5a7f" # tag=v1.2.3',
            autoReplaceStringTemplate:
              '"{{#if newDigest}}{{newDigest}}"{{#if newValue}} # tag={{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
          },
        ],
      });
    });

    it('extracts SHA revs with renovate pin comments as digest pins with currentValue', () => {
      const config = `[[repos]]
repo = "https://github.com/python-jsonschema/check-jsonschema"
rev = "9f48a48aa91a6040d749ad68ec70907d907a5a7f" # renovate: pin @v1.2.3
hooks = [{ id = "check-metaschema" }]`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentDigest: '9f48a48aa91a6040d749ad68ec70907d907a5a7f',
            currentValue: 'v1.2.3',
            datasource: 'github-tags',
            depName: 'python-jsonschema/check-jsonschema',
            depType: 'repository',
            packageName: 'python-jsonschema/check-jsonschema',
            replaceString:
              '"9f48a48aa91a6040d749ad68ec70907d907a5a7f" # renovate: pin @v1.2.3',
            autoReplaceStringTemplate:
              '"{{#if newDigest}}{{newDigest}}"{{#if newValue}} # renovate: pin @{{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
          },
        ],
      });
    });

    it('extracts SHA revs with version comments and trailing notes without consuming the note', () => {
      const config = `[[repos]]
repo = "https://github.com/python-jsonschema/check-jsonschema"
rev = "9f48a48aa91a6040d749ad68ec70907d907a5a7f" # @v1.2.3 # note
hooks = [{ id = "check-metaschema" }]`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentDigest: '9f48a48aa91a6040d749ad68ec70907d907a5a7f',
            currentValue: 'v1.2.3',
            datasource: 'github-tags',
            depName: 'python-jsonschema/check-jsonschema',
            depType: 'repository',
            packageName: 'python-jsonschema/check-jsonschema',
            replaceString:
              '"9f48a48aa91a6040d749ad68ec70907d907a5a7f" # @v1.2.3',
            autoReplaceStringTemplate:
              '"{{#if newDigest}}{{newDigest}}"{{#if newValue}} # @{{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
          },
        ],
      });
    });

    it('marks SHA revs with unrecognized comments as unspecified-version', () => {
      const config = `[[repos]]
repo = "https://github.com/python-jsonschema/check-jsonschema"
rev = "9f48a48aa91a6040d749ad68ec70907d907a5a7f" # tag=v3.0.0-alpha.9-for-vscode
hooks = [{ id = "check-metaschema" }]`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: '9f48a48aa91a6040d749ad68ec70907d907a5a7f',
            datasource: 'github-tags',
            depName: 'python-jsonschema/check-jsonschema',
            depType: 'repository',
            packageName: 'python-jsonschema/check-jsonschema',
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('marks SHA revs with non-version trailing comments as unspecified-version', () => {
      const config = `[[repos]]
repo = "https://github.com/python-jsonschema/check-jsonschema"
rev = "9f48a48aa91a6040d749ad68ec70907d907a5a7f" # pin this
hooks = [{ id = "check-metaschema" }]`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: '9f48a48aa91a6040d749ad68ec70907d907a5a7f',
            datasource: 'github-tags',
            depName: 'python-jsonschema/check-jsonschema',
            depType: 'repository',
            packageName: 'python-jsonschema/check-jsonschema',
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('keeps duplicate repo and SHA entries correlated to the correct replace strings', () => {
      const config = `[[repos]]
repo = "https://github.com/python-jsonschema/check-jsonschema"
rev = "9f48a48aa91a6040d749ad68ec70907d907a5a7f" # v1.2.3

[[repos]]
repo = "https://github.com/python-jsonschema/check-jsonschema"
rev = "9f48a48aa91a6040d749ad68ec70907d907a5a7f" # tag=v1.2.4`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentDigest: '9f48a48aa91a6040d749ad68ec70907d907a5a7f',
            currentValue: 'v1.2.3',
            datasource: 'github-tags',
            depName: 'python-jsonschema/check-jsonschema',
            depType: 'repository',
            packageName: 'python-jsonschema/check-jsonschema',
            replaceString:
              '"9f48a48aa91a6040d749ad68ec70907d907a5a7f" # v1.2.3',
            autoReplaceStringTemplate:
              '"{{#if newDigest}}{{newDigest}}"{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
          },
          {
            currentDigest: '9f48a48aa91a6040d749ad68ec70907d907a5a7f',
            currentValue: 'v1.2.4',
            datasource: 'github-tags',
            depName: 'python-jsonschema/check-jsonschema',
            depType: 'repository',
            packageName: 'python-jsonschema/check-jsonschema',
            replaceString:
              '"9f48a48aa91a6040d749ad68ec70907d907a5a7f" # tag=v1.2.4',
            autoReplaceStringTemplate:
              '"{{#if newDigest}}{{newDigest}}"{{#if newValue}} # tag={{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
          },
        ],
      });
    });

    it('extracts additional_dependencies for node/python/golang and ignores invalid node specs', () => {
      const result = extractPackageFile(
        additionalDependenciesPrekConfig,
        filename,
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '^3.6.2',
            datasource: NpmDatasource.id,
            depName: 'prettier',
            depType: 'pre-commit-node',
            packageName: 'prettier',
          },
          {
            currentValue: '^5.2.2',
            datasource: NpmDatasource.id,
            depName: '@trivago/prettier-plugin-sort-imports',
            depType: 'pre-commit-node',
            packageName: '@trivago/prettier-plugin-sort-imports',
          },
          {
            currentValue: 'v4.0.0-alpha.8',
            datasource: 'github-tags',
            depName: 'pre-commit/mirrors-prettier',
            depType: 'repository',
            packageName: 'pre-commit/mirrors-prettier',
          },
          {
            currentValue: '==2.31.0',
            currentVersion: '2.31.0',
            datasource: PypiDatasource.id,
            depName: 'types-requests',
            depType: 'pre-commit-python',
            packageName: 'types-requests',
          },
          {
            currentValue: 'v1.15.0',
            datasource: 'github-tags',
            depName: 'pre-commit/mirrors-mypy',
            depType: 'repository',
            packageName: 'pre-commit/mirrors-mypy',
          },
          {
            currentValue: 'v0.10.0',
            datasource: GoDatasource.id,
            depName: 'github.com/wasilibs/go-shellcheck/cmd/shellcheck',
            depType: 'pre-commit-golang',
          },
          {
            currentValue: 'v1.7.7',
            datasource: 'github-tags',
            depName: 'rhysd/actionlint',
            depType: 'repository',
            packageName: 'rhysd/actionlint',
          },
        ],
      });
    });

    it('extracts local hook additional_dependencies and ignores meta/builtin hook additional_dependencies from valid logical repos', () => {
      const config = `[[repos]]
repo = "local"
rev = "v1.0.0"

[[repos.hooks]]
id = "local-hook"
language = "node"
additional_dependencies = [
  "prettier@^3.6.2",
]

[[repos]]
repo = "meta"
rev = "v1.0.0"

[[repos.hooks]]
id = "meta-hook"
language = "node"
additional_dependencies = [
  "eslint@^9.0.0",
]

[[repos]]
repo = "builtin"
rev = "v1.0.0"

[[repos.hooks]]
id = "builtin-hook"
language = "python"
additional_dependencies = [
  "types-requests==2.31.0",
]`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: '^3.6.2',
            datasource: NpmDatasource.id,
            depName: 'prettier',
            depType: 'pre-commit-node',
            packageName: 'prettier',
          },
        ],
      });
    });

    it('drops malformed typed repos and continues extracting valid dependencies', () => {
      const result = extractPackageFile(malformedTypedRepoPrekConfig, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.7.7',
            datasource: 'github-tags',
            depName: 'rhysd/actionlint',
            depType: 'repository',
            packageName: 'rhysd/actionlint',
          },
        ],
      });
    });

    it('ignores repos without rev', () => {
      const result = extractPackageFile(missingRevPrekConfig, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.7.7',
            datasource: 'github-tags',
            depName: 'rhysd/actionlint',
            depType: 'repository',
            packageName: 'rhysd/actionlint',
          },
        ],
      });
    });

    it('keeps invalid URLs with invalid-url skip reason and continues extraction', () => {
      const result = extractPackageFile(invalidUrlPrekConfig, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            datasource: undefined,
            depName: undefined,
            depType: 'repository',
            packageName: undefined,
            skipReason: 'invalid-url',
          },
          {
            currentValue: 'v1.0.0',
            datasource: 'github-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
          },
        ],
      });
    });

    it('preserves invalid-url skip reason for bare SHA revs with malformed repository URLs', () => {
      const config = `[[repos]]
repo = "https://github.com/"
rev = "9f48a48aa91a6040d749ad68ec70907d907a5a7f"`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: '9f48a48aa91a6040d749ad68ec70907d907a5a7f',
            datasource: undefined,
            depName: undefined,
            depType: 'repository',
            packageName: undefined,
            skipReason: 'invalid-url',
          },
        ],
      });
    });

    it('marks host-only repository URLs as invalid', () => {
      const config = `[[repos]]
repo = "https://github.com/"
rev = "v1.0.0"`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            datasource: undefined,
            depName: undefined,
            depType: 'repository',
            packageName: undefined,
            skipReason: 'invalid-url',
          },
        ],
      });
    });

    it('detects gitlab datasource via platform detection for custom gitlab hosts', () => {
      const result = extractPackageFile(customGitlabHostPrekConfig, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            datasource: 'gitlab-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
            registryUrls: ['https://gitlab.enterprise.com'],
          },
        ],
      });
    });

    it('detects gitlab datasource for custom gitlab hosts with explicit ports', () => {
      const config = `[[repos]]
repo = "https://gitlab.enterprise.com:8443/pre-commit/pre-commit-hooks"
rev = "v1.0.0"`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            datasource: 'gitlab-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
            registryUrls: ['https://gitlab.enterprise.com:8443'],
          },
        ],
      });
    });

    it('extracts frozen SHA revs for custom gitlab hosts', () => {
      const config = `[[repos]]
repo = "https://gitlab.enterprise.com/pre-commit/pre-commit-hooks"
rev = "631208b7aac2daa8b707f55e7331f9112b0e062d" # frozen: v1.44.0`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '"{{#if newDigest}}{{newDigest}}"{{#if newValue}} # frozen: {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}"{{/unless}}',
            currentDigest: '631208b7aac2daa8b707f55e7331f9112b0e062d',
            currentValue: 'v1.44.0',
            datasource: 'gitlab-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
            registryUrls: ['https://gitlab.enterprise.com'],
            replaceString:
              '"631208b7aac2daa8b707f55e7331f9112b0e062d" # frozen: v1.44.0',
          },
        ],
      });
    });

    it('can handle private git repos using hostRules', () => {
      // url only
      hostRules.find.mockReturnValueOnce({ token: 'value1' });
      // hostType=github
      hostRules.find.mockReturnValueOnce({});
      // hostType=gitlab
      hostRules.find.mockReturnValueOnce({ token: 'value' });

      const result = extractPackageFile(enterprisePrekConfig, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            datasource: 'gitlab-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
            registryUrls: ['https://enterprise.com'],
          },
        ],
      });
    });

    it('preserves registryUrls for custom github hosts detected via hostRules', () => {
      hostRules.hostType.mockReturnValueOnce('github');

      const result = extractPackageFile(enterprisePrekConfig, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            datasource: 'github-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
            registryUrls: ['https://enterprise.com'],
          },
        ],
      });
    });

    it('can handle invalid private git repos', () => {
      hostRules.find.mockReturnValue({});
      const result = extractPackageFile(enterprisePrekConfig, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
            registryUrls: ['https://enterprise.com'],
            skipReason: 'unknown-registry',
          },
        ],
      });
    });

    it('can handle unknown private git repos when hostRules url exists but hostType does not match', () => {
      hostRules.find.mockReturnValueOnce({ token: 'value1' });
      hostRules.find.mockReturnValue({});
      const result = extractPackageFile(enterprisePrekConfig, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
            registryUrls: ['https://enterprise.com'],
            skipReason: 'unknown-registry',
          },
        ],
      });
    });

    it('strips credentials from registryUrls for custom hosts', () => {
      hostRules.find.mockReturnValue({});
      const config = `[[repos]]
repo = "https://user:pass@enterprise.com/pre-commit/pre-commit-hooks"
rev = "v1.0.0"`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
            registryUrls: ['https://enterprise.com'],
            skipReason: 'unknown-registry',
          },
        ],
      });
    });

    it('ignores hook-level minimum_prek_version', () => {
      const config = `[[repos]]
repo = "https://github.com/pre-commit/pre-commit-hooks"
rev = "v5.0.0"

[[repos.hooks]]
id = "trailing-whitespace"
minimum_prek_version = "0.99.0"`;

      const result = extractPackageFile(config, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v5.0.0',
            datasource: 'github-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
          },
        ],
      });
    });
  });
});
