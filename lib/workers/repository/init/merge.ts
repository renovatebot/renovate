import {
  isNonEmptyArray,
  isNonEmptyObject,
  isNonEmptyString,
  isString,
} from '@sindresorhus/is';
import { dequal } from 'dequal';
import { getConfigFileNames } from '../../../config/app-strings.ts';
import { decryptConfig } from '../../../config/decrypt.ts';
import { mergeChildConfig } from '../../../config/index.ts';
import { massageConfig } from '../../../config/massage.ts';
import { migrateAndValidate } from '../../../config/migrate-validate.ts';
import { migrateConfig } from '../../../config/migration.ts';
import { parseFileConfig } from '../../../config/parse.ts';
import * as presets from '../../../config/presets/index.ts';
import { applySecretsAndVariablesToConfig } from '../../../config/secrets.ts';
import type {
  AllConfig,
  MigratedConfig,
  RenovateConfig,
  ValidationMessage,
} from '../../../config/types.ts';
import * as configValidation from '../../../config/validation.ts';
import { ConfigValidationTopic } from '../../../config/validation-helpers/types.ts';
import {
  CONFIG_VALIDATION,
  REPOSITORY_CHANGED,
} from '../../../constants/error-messages.ts';
import { pkg } from '../../../expose.ts';
import { logger } from '../../../logger/index.ts';
import * as npmApi from '../../../modules/datasource/npm/index.ts';
import { platform } from '../../../modules/platform/index.ts';
import { scm } from '../../../modules/platform/scm.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import type { HostRule } from '../../../types/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { getCache } from '../../../util/cache/repository/index.ts';
import { clone } from '../../../util/clone.ts';
import { getInheritedOrGlobal, parseJson } from '../../../util/common.ts';
import { setUserEnv } from '../../../util/env.ts';
import { readLocalFile, readSystemFile } from '../../../util/fs/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import * as queue from '../../../util/http/queue.ts';
import * as throttle from '../../../util/http/throttle.ts';
import { maskToken } from '../../../util/mask.ts';
import { coerceObject } from '../../../util/object.ts';
import { regEx } from '../../../util/regex.ts';
import { coerceString } from '../../../util/string.ts';
import { safeStringify } from '../../../util/stringify.ts';
import { parseUrl } from '../../../util/url.ts';
import { getOnboardingConfig } from '../onboarding/branch/config.ts';
import {
  getOnboardingConfigFromCache,
  getOnboardingFileNameFromCache,
  setOnboardingConfigDetails,
} from '../onboarding/branch/onboarding-branch-cache.ts';
import {
  OnboardingState,
  getDefaultConfigFileName,
} from '../onboarding/common.ts';
import { filterAllowedEnv } from './filter-allowed-env.ts';
import type { RepoFileConfig, RepositoryWorkerConfig } from './types.ts';

export async function detectConfigFile(): Promise<string | null> {
  const fileList = await scm.getFileList();
  for (const fileName of getConfigFileNames()) {
    if (fileName === 'package.json') {
      try {
        const pJson = JSON.parse(
          (await readLocalFile('package.json', 'utf8'))!,
        );
        if (pJson.renovate) {
          logger.warn(
            'Using package.json for Renovate config is deprecated - please use a dedicated configuration file instead',
          );
          return 'package.json';
        }
      } catch {
        // Do nothing
      }
    } else if (fileList.includes(fileName)) {
      return fileName;
    }
  }
  return null;
}

export async function detectRepoFileConfig(
  branchName?: string,
): Promise<RepoFileConfig> {
  const cache = getCache();
  let { configFileName } = cache;
  if (isNonEmptyString(configFileName)) {
    let configFileRaw: string | null;
    try {
      configFileRaw = await platform.getRawFile(
        configFileName,
        undefined,
        branchName,
      );
    } catch (err) {
      // istanbul ignore if
      if (err instanceof ExternalHostError) {
        throw err;
      }
      configFileRaw = null;
    }
    if (configFileRaw) {
      let configFileParsed = parseJson(configFileRaw, configFileName) as any;
      if (configFileName === 'package.json') {
        configFileParsed = configFileParsed.renovate;
      }
      return { configFileName, configFileParsed };
    }
    logger.debug('Existing config file no longer exists');
    delete cache.configFileName;
  }

  if (OnboardingState.onboardingCacheValid) {
    configFileName = getOnboardingFileNameFromCache();
  } else {
    configFileName = coerceString(await detectConfigFile());
  }

  if (!configFileName) {
    logger.debug('No renovate config file found');
    cache.configFileName = '';
    return {};
  }
  cache.configFileName = configFileName;
  logger.debug(`Found ${configFileName} config file`);
  // TODO #22198
  let configFileParsed: any;
  let configFileRaw: string | undefined | null;

  if (OnboardingState.onboardingCacheValid) {
    const cachedConfig = getOnboardingConfigFromCache();
    const parsedConfig = cachedConfig ? JSON.parse(cachedConfig) : undefined;
    if (parsedConfig) {
      setOnboardingConfigDetails(configFileName, JSON.stringify(parsedConfig));
      return { configFileName, configFileParsed: parsedConfig };
    }
  }

  if (configFileName === 'package.json') {
    // We already know it parses
    configFileParsed = JSON.parse(
      // TODO #22198
      (await readLocalFile('package.json', 'utf8'))!,
    ).renovate;
    if (isString(configFileParsed)) {
      logger.debug('Massaging string renovate config to extends array');
      configFileParsed = { extends: [configFileParsed] };
    }
    logger.debug({ config: configFileParsed }, 'package.json>renovate config');
  } else {
    configFileRaw = await readLocalFile(configFileName, 'utf8');
    // istanbul ignore if
    if (!isString(configFileRaw)) {
      logger.warn({ configFileName }, 'Null contents when reading config file');
      throw new Error(REPOSITORY_CHANGED);
    }
    // istanbul ignore if
    if (!configFileRaw.length) {
      configFileRaw = '{}';
    }

    const parseResult = parseFileConfig(configFileName, configFileRaw);

    if (!parseResult.success) {
      return {
        configFileName,
        configFileParseError: {
          validationError: parseResult.validationError,
          validationMessage: parseResult.validationMessage,
        },
      };
    }
    configFileParsed = parseResult.parsedContents;
    logger.debug(
      { fileName: configFileName, config: configFileParsed },
      'Repository config',
    );
  }

  setOnboardingConfigDetails(configFileName, JSON.stringify(configFileParsed));
  return { configFileName, configFileParsed };
}

export function checkForRepoConfigError(repoConfig: RepoFileConfig): void {
  if (!repoConfig.configFileParseError) {
    return;
  }
  const error = new Error(CONFIG_VALIDATION);
  error.validationSource = repoConfig.configFileName;
  error.validationError = repoConfig.configFileParseError.validationError;
  error.validationMessage = repoConfig.configFileParseError.validationMessage;
  throw error;
}

/**
 * Validation source for `repositories[]` object-entry config.
 *
 * As these are managed by the self-hosted admin's global config (`config.js`, or through environment variables, CLI options) we shouldn't report this as an issue the repo owner has introduced.
 */
const repositoriesEntrySource = 'Self-hosted config (`repositories[]`)';

const repoFileValidationError =
  'The Renovate configuration file contains some invalid settings';

const repositoriesEntryValidationError =
  'The self-hosted `repositories[]` config contains some invalid settings';

function throwConfigValidationError(
  validationSource: string | undefined,
  errors: ValidationMessage[],
  validationError = repoFileValidationError,
): never {
  const error = new Error(CONFIG_VALIDATION);
  error.validationSource = validationSource;
  error.validationError = validationError;
  error.validationMessage = errors.map((e) => e.message).join(', ');
  throw error;
}

/**
 * Validate a fully-resolved config (i.e. after `resolveConfigPresets`).
 *
 * If there are top-level `allowedEnv`/`allowedHeaders` violations, these are reported with `ConfigValidationTopic.Security` and always fail a validation, as they are sensitive config options that need to be blocked.
 *
 * All other issues will be a WARN, unless `configValidationError=true`, because these are resolved config options and may not be in control of the repository owner.
 *
 * `validationSource` is reported to the user; use `repositoriesEntrySource` and `repositoriesEntryValidationError` for admin-controlled object entries so a fault is not blamed on the repo owner.
 */
async function validateResolvedConfig(
  resolved: RenovateConfig,
  validationSource: string | undefined,
  strict: boolean,
  validationError?: string,
): Promise<void> {
  const { errors, warnings } = await configValidation.validateConfig(
    'repo',
    // `validateConfig` expects massaged input
    massageConfig(resolved),
  );

  // Security findings are collected from the warnings too: `validateConfig` folds the results of the sub-validations it runs (notably `onboardingConfig`) into its warnings, and a finding is no less real for having been reported from within one
  const securityErrors = [...errors, ...warnings].filter(
    (err) => err.topic === ConfigValidationTopic.Security,
  );
  const otherErrors = errors.filter(
    (err) => err.topic !== ConfigValidationTopic.Security,
  );
  const otherWarnings = warnings.filter(
    (err) => err.topic !== ConfigValidationTopic.Security,
  );

  // before throwing, make sure that any other errors or warnings are logged, as there may be important findings
  if (otherErrors.length || otherWarnings.length) {
    logger.debug(
      { errors: otherErrors, warnings: otherWarnings },
      'Config validation failed on resolved config, for non-security-sensitive reasons',
    );
  }

  if (securityErrors.length) {
    throwConfigValidationError(
      validationSource,
      securityErrors,
      validationError,
    );
  }
  if (strict && otherErrors.length) {
    throwConfigValidationError(validationSource, otherErrors, validationError);
  }
}

/**
 * Identify a single `env` variable, or a single header of a host rule, by name and value.
 *
 * As `env` is replaced wholesale and `hostRules` is `mergeable`, self-hosted config and repo config end up indistinguishable in the resolved config, so we need a stable way to look a given name and value up.
 */
function nameValueIdentity(name: string, value: string): string {
  // use safeStringify to avoid any potential for an attacker-controlled value to attempt to try and fake the separator and inject in their value as priority
  return safeStringify([name, value]);
}

/**
 * Index a set of host rules' headers by {@link nameValueIdentity}, recording the `matchHost` values each is set for (`null` for a host-less rule, which matches every host).
 */
function headersByIdentity(
  rules: HostRule[] | undefined,
): Map<string, Set<string | null>> {
  const result = new Map<string, Set<string | null>>();
  for (const rule of coerceArray(rules)) {
    for (const [name, value] of Object.entries(coerceObject(rule.headers))) {
      const identity = nameValueIdentity(name, value);
      const hosts = result.get(identity) ?? new Set<string | null>();
      hosts.add(rule.matchHost ?? null);
      result.set(identity, hosts);
    }
  }
  return result;
}

/**
 * Whether every request matched by `matchHost` is also matched by `adminMatchHost` - i.e. a rule scoped to `matchHost` cannot reach any host the admin's own rule does not already reach.
 *
 * A bare hostname is compared as its `https://` URL. `matchesHost` treats a bare `adminMatchHost` as also covering its subdomains, which errs on the admin-friendly side: those hosts sit within the admin's own domain.
 */
function isWithinHost(matchHost: string, adminMatchHost: string): boolean {
  const url = parseUrl(matchHost) ? matchHost : `https://${matchHost}`;
  return hostRules.matchesHost(url, adminMatchHost);
}

/**
 * Migrate a config, tolerating a migration which throws.
 *
 * `hostRules` migration throws when a rule carries more than one host-matching field. That is per-rule invalid config which {@link applyHostRules} logs and skips over, keeping the rest of the run going, so migrating a whole config here must not escalate it into an error which aborts the repository.
 */
function migrateConfigOrWarn(config: RenovateConfig): MigratedConfig {
  try {
    return migrateConfig(config);
  } catch (err) {
    logger.warn({ err }, 'Error migrating config');
    return { isMigrated: false, migratedConfig: config };
  }
}

/**
 * The security-sensitive values (`env`, and `hostRules[].headers`) the self-hosted admin supplied, indexed by {@link nameValueIdentity}; the headers additionally record the `matchHost` values each was set for.
 *
 * `mergeChildConfig` promotes `force` values to the top level, so each config contributes its `force` alongside its top-level values.
 */
interface AdminSuppliedValues {
  env: Set<string>;
  headers: Map<string, Set<string | null>>;
}

/**
 * Migrate a set of host rules, so that their `matchHost` compares like for like against the resolved config's own: migration rewrites them (e.g. a legacy `hostName` becoming a `matchHost`, or a bare `matchHost` gaining a scheme), and the resolved config only ever contains the migrated spellings.
 */
function migratedHostRules(rules: HostRule[] | undefined): HostRule[] {
  if (!isNonEmptyArray(rules)) {
    return [];
  }
  return coerceArray(
    migrateConfigOrWarn({ hostRules: rules }).migratedConfig.hostRules,
  );
}

/**
 * Collect the {@link AdminSuppliedValues} of every config the self-hosted admin supplied.
 *
 * A preset is only ever resolved into the config which extends it, so a config here is the *resolved* form of an admin config: whatever the presets the admin chose to extend contribute is as much theirs as a value they wrote inline.
 */
function adminSuppliedValues(
  adminConfigs: RenovateConfig[],
): AdminSuppliedValues {
  const env = new Set<string>();
  const headers = new Map<string, Set<string | null>>();

  for (const adminConfig of adminConfigs) {
    for (const source of [adminConfig, adminConfig.force]) {
      for (const [name, value] of Object.entries(coerceObject(source?.env))) {
        env.add(nameValueIdentity(name, value));
      }
      for (const [identity, matchHosts] of headersByIdentity(
        migratedHostRules(source?.hostRules),
      )) {
        const hosts = headers.get(identity) ?? new Set<string | null>();
        for (const matchHost of matchHosts) {
          hosts.add(matchHost);
        }
        headers.set(identity, hosts);
      }
    }
  }

  return { env, headers };
}

/**
 * Return `resolved` without the security-sensitive (`env` and `hostRules[].headers`) values the self-hosted admin supplied themselves.
 *
 * `allowedEnv`/`allowedHeaders` exist to constrain what repository config, and the presets it extends, may inject; the self-hosted admin is who sets those allowlists, so their own values are not violations of them.
 *
 * Reporting them would abort the repository and file a "Fix Renovate Configuration" issue whose cause the repository's owners can neither see nor fix.
 */
function withoutAdminSuppliedValues(
  resolved: RenovateConfig,
  admin: AdminSuppliedValues,
): RenovateConfig {
  const result = { ...resolved };

  if (result.env) {
    result.env = Object.fromEntries(
      Object.entries(result.env).filter(
        ([name, value]) => !admin.env.has(nameValueIdentity(name, value)),
      ),
    );
  }

  // A header is the admin's own when its name and value match one the admin set for hosts that already cover this rule's hosts - the exact `matchHost` spelling must not matter, as migration and presets can re-spell (e.g. add a scheme) or narrow (e.g. a subpath) it
  if (result.hostRules) {
    result.hostRules = result.hostRules.map((rule) => ({
      ...rule,
      headers: Object.fromEntries(
        Object.entries(coerceObject(rule.headers)).filter(([name, value]) => {
          const adminHosts = admin.headers.get(nameValueIdentity(name, value));
          if (!adminHosts) {
            // not a header the admin set - report it
            return true;
          }
          if (adminHosts.has(null)) {
            // the admin already sends it to every host
            return false;
          }
          // a host-less rule reaches every host, so only a host-less admin header (above) can exempt it
          return !(
            rule.matchHost &&
            [...adminHosts].some(
              (adminHost) =>
                adminHost !== null && isWithinHost(rule.matchHost!, adminHost),
            )
          );
        }),
      ),
    }));
  }

  // `mergeChildConfig` promotes `force` values into the config it returns, so the admin's own `force.env`/`force.hostRules[].headers` are applied - and exempted - the same way their top-level equivalents are
  if (result.force) {
    result.force = withoutAdminSuppliedValues(result.force, admin);
  }

  return result;
}

// Check for repository config
export async function mergeRenovateConfig(
  config: RepositoryWorkerConfig,
  branchName?: string,
): Promise<RenovateConfig> {
  let returnConfig: RepositoryWorkerConfig = { ...config };
  let repoConfig: RepoFileConfig = {};
  if (getInheritedOrGlobal('requireConfig') !== 'ignored') {
    repoConfig = await detectRepoFileConfig(branchName);
  }
  if (!repoConfig.configFileParsed && config.mode === 'silent') {
    logger.debug(
      'When mode=silent and repo has no config file, we use the onboarding config as repo config',
    );
    const configFileName = getDefaultConfigFileName();
    repoConfig = {
      configFileName,
      configFileParsed: await getOnboardingConfig(config),
    };
  }
  const configFileParsed = coerceObject(repoConfig?.configFileParsed);
  const resolvedRepoConfig = await resolveStaticRepoConfig(
    configFileParsed,
    process.env.RENOVATE_X_STATIC_REPO_CONFIG_FILE,
  );

  // Apply the repositories[] object-entry config between global config and
  // repository file config.
  // Must run after repository file config is loaded so its `ignorePresets` can
  // be included when resolving object-entry presets.
  const repoEntryConfig = returnConfig.repositoryEntryConfig;
  delete returnConfig.repositoryEntryConfig;

  // The presets the self-hosted admin's own config extends are their config too - a repository which merely inherits them must neither be blamed for what they contribute, nor have it filtered out from under it.
  // They are resolved separately because below they are resolved together with the repository's own presets, leaving no way to tell one from the other; a failure here is left to that resolution to report, as it is the one whose result is used.
  let adminPresetConfig: AllConfig = {};
  if (isNonEmptyArray(returnConfig.extends)) {
    try {
      ({ config: adminPresetConfig } = await presets.resolveConfigPresets(
        { extends: returnConfig.extends },
        config,
        config.ignorePresets,
      ));
    } catch (err) {
      logger.debug(
        { err },
        'Error resolving the self-hosted config presets - continuing without their exemption',
      );
    }
  }

  // self-hosted configuration is always allowed
  // `force.env` is included because `mergeChildConfig` promotes `force` values to the top level as configs are merged
  const adminSuppliedEnv = {
    // presets the admin extends: as much theirs as anything they set inline, which is why they are listed first - the values they set themselves win
    ...coerceObject(adminPresetConfig.env),
    ...coerceObject(adminPresetConfig.force?.env),
    // `env` settings the self-hosted admin supplied (via `config.js`, etc), `env`, etc
    ...coerceObject(config.env),
    ...coerceObject(config.force?.env),
    // `repositories[]` entry for this repo - refreshed with the resolved values below, once its own presets, secrets and variables have been applied
    ...coerceObject(repoEntryConfig?.env),
    ...coerceObject(repoEntryConfig?.force?.env),
  };

  // every config the self-hosted admin supplied, in resolved form, for {@link adminSuppliedValues}
  const adminConfigs: RenovateConfig[] = [config, adminPresetConfig];

  if (isNonEmptyObject(repoEntryConfig)) {
    const repoEntry = repoEntryConfig as RenovateConfig;
    const toResolve: RenovateConfig = {
      ...repoEntry,
      extends: [
        ...coerceArray(returnConfig.extends),
        ...coerceArray(repoEntry.extends),
      ],
      ignorePresets: [
        ...coerceArray(returnConfig.ignorePresets),
        ...coerceArray(repoEntry.ignorePresets),
        ...coerceArray(resolvedRepoConfig.ignorePresets),
      ],
    };
    delete returnConfig.extends;

    let { config: resolvedRepoEntry } = await presets.resolveConfigPresets(
      toResolve,
      config,
    );

    // Migrate before validating so legacy option names contributed by the entry or its presets are migrated rather than reported as invalid options.
    const entryMigration = migrateConfigOrWarn(resolvedRepoEntry);
    if (entryMigration.isMigrated) {
      resolvedRepoEntry = entryMigration.migratedConfig;
    }

    // Migrate the entry's own config the same way, so its values compare like for like below: migration can rewrite them (e.g. a legacy `hostName` becoming a `matchHost`, or a bare `matchHost` gaining a scheme), and the resolved config only ever contains the migrated spellings
    const { migratedConfig: migratedEntry } = migrateConfigOrWarn(toResolve);
    // `resolveConfigPresets` removes both of these from its result
    delete migratedEntry.extends;
    delete migratedEntry.ignorePresets;

    // The entry, and every preset it extends, is the self-hosted admin's own config, so its `env`/`headers` are exempt from the allowlists the admin set - but the rest of the resolved result is still worth validating before any of it is applied (npmrc, hostRules, env).
    // When resolution and migration changed nothing, the presets contributed nothing and the entry itself was already validated as part of the admin's global config, so skip the (costly) validation walk entirely.
    adminConfigs.push(resolvedRepoEntry);
    if (!dequal(resolvedRepoEntry, migratedEntry)) {
      await validateResolvedConfig(
        withoutAdminSuppliedValues(
          resolvedRepoEntry,
          adminSuppliedValues(adminConfigs),
        ),
        repositoriesEntrySource,
        config.configValidationError === true,
        repositoriesEntryValidationError,
      );
    }

    applyNpmrc(resolvedRepoEntry, 'resolvedRepoEntry');

    const resolvedRepoEntryWithSecrets = applySecretsAndVariablesToConfig({
      config: resolvedRepoEntry,
      // like the repository config below, the entry can carry its own `secrets`/`variables` - `validateConfigSecretsAndVariables` validates them at startup
      secrets: mergeChildConfig(
        coerceObject(config.secrets),
        coerceObject(resolvedRepoEntry.secrets),
      ),
      variables: mergeChildConfig(
        coerceObject(config.variables),
        coerceObject(resolvedRepoEntry.variables),
      ),
    });

    // Refresh the admin-supplied snapshot from the resolved entry: it also carries whatever the presets the entry extends contributed, and its `env` values may contain `{{ secrets.* }}`/`{{ variables.* }}` templates only interpolated here - e.g. when the secrets are defined on the entry itself rather than globally.
    // Interpolation is recursive, so the interpolated `force.env` values stay nested under `force`.
    Object.assign(
      adminSuppliedEnv,
      coerceObject(resolvedRepoEntryWithSecrets.env),
      coerceObject(resolvedRepoEntryWithSecrets.force?.env),
    );

    // the `repositories[]` entry is the self-hosted admin's own config - as its `env` is already treated as admin-supplied, its rules are `trusted` too, so that an admin can still override a header they set globally for just this repository
    applyHostRules(resolvedRepoEntryWithSecrets, { trusted: true });
    returnConfig = mergeChildConfig(returnConfig, resolvedRepoEntryWithSecrets);
  }

  if (isNonEmptyArray(returnConfig.extends)) {
    resolvedRepoConfig.extends = [
      ...coerceArray(returnConfig.extends),
      ...coerceArray(resolvedRepoConfig.extends),
    ];
    delete returnConfig.extends;
  }
  checkForRepoConfigError(repoConfig);
  const migratedConfig = await migrateAndValidate(config, resolvedRepoConfig);
  if (migratedConfig.errors?.length) {
    throwConfigValidationError(
      repoConfig.configFileName,
      migratedConfig.errors,
    );
  }
  if (migratedConfig.warnings) {
    returnConfig.warnings = [
      ...coerceArray(returnConfig.warnings),
      ...migratedConfig.warnings,
    ];
  }
  delete migratedConfig.errors;
  delete migratedConfig.warnings;
  // TODO #22198
  const repository = config.repository!;
  // Decrypt before resolving in case we need npm authentication for any presets
  const decryptedConfig = await decryptConfig(migratedConfig, repository);
  applyNpmrc(decryptedConfig, 'decrypted');

  // NOTE that this should not be used with any other configuration (`resolvedConfig`, etc) below, as they will include addditionally merged configuration
  // Decrypted secrets are sanitised, so should be safe to log
  await logShallowConfig(decryptedConfig, config);

  // Decrypt after resolving in case the preset contains npm authentication instead
  const { config: configToDecrypt } = await presets.resolveConfigPresets(
    decryptedConfig,
    config,
    config.ignorePresets,
  );
  let resolvedConfig = await decryptConfig(configToDecrypt, repository);
  logger.trace({ config: resolvedConfig }, 'resolved config');
  const migrationResult = migrateConfig(resolvedConfig);
  if (migrationResult.isMigrated) {
    logger.debug('Resolved config needs migrating');
    logger.trace({ config: resolvedConfig }, 'resolved config after migrating');
    resolvedConfig = migrationResult.migratedConfig;
  }

  // Validate the fully-resolved repository config, enforcing validation is applied against all stages of the preset, and providing defence-in-depth for any sensitive config options
  // note that we do not need to re-run `migrateAndValidate` if we're already at the same configuration that we've previously resolved, decrypted and migrated, so we can avoid a costly re-validation
  if (!dequal(resolvedConfig, migratedConfig)) {
    await validateResolvedConfig(
      // the admin's own `extends` are resolved into this config alongside the repository's, so exempt what they contributed: the repository can neither see nor fix it
      withoutAdminSuppliedValues(
        resolvedConfig,
        adminSuppliedValues(adminConfigs),
      ),
      // a repository that is not yet onboarded has no config file to blame; 'config' mirrors other unattributable validation errors (e.g. `decryptConfig`)
      repoConfig.configFileName ?? 'config',
      config.configValidationError === true,
    );
  }
  if (isString(resolvedConfig.npmrc)) {
    logger.debug(
      'Ignoring any .npmrc files in repository due to configured npmrc',
    );
  }
  applyNpmrc(resolvedConfig, 'resolved');
  resolvedConfig = applySecretsAndVariablesToConfig({
    config: resolvedConfig,
    secrets: mergeChildConfig(
      coerceObject(config.secrets),
      coerceObject(resolvedConfig.secrets),
    ),
    variables: mergeChildConfig(
      coerceObject(config.variables),
      coerceObject(resolvedConfig.variables),
    ),
  });

  applyHostRules(resolvedConfig);
  returnConfig = mergeChildConfig(returnConfig, resolvedConfig);
  ({ config: returnConfig } = await presets.resolveConfigPresets(
    returnConfig,
    config,
  ));
  returnConfig.renovateJsonPresent = true;
  // istanbul ignore if
  if (returnConfig.ignorePaths?.length) {
    logger.debug(
      { ignorePaths: returnConfig.ignorePaths },
      `Found repo ignorePaths`,
    );
  }

  setUserEnv(filterAllowedEnv(returnConfig.env, adminSuppliedEnv));
  delete returnConfig.env;

  return returnConfig;
}

export function applyNpmrc(
  config: RenovateConfig,
  configType?: 'resolved' | 'resolvedRepoEntry' | 'decrypted',
): void {
  setNpmTokenInNpmrc(config);
  if (!isString(config.npmrc)) {
    return;
  }
  logger.debug(
    `Setting npmrc from ${configType ? `${configType} ` : ''}config`,
  );
  npmApi.setNpmrc(config.npmrc);
}

export function applyHostRules(
  config: RenovateConfig,
  options?: hostRules.AddHostRuleOptions,
): void {
  if (!config.hostRules) {
    return;
  }

  logger.debug('Setting hostRules from config');
  // `hostRules.add` enforces `allowedHeaders` on every rule it registers
  for (const rule of config.hostRules) {
    try {
      hostRules.add(rule, options);
    } catch (err) {
      logger.warn({ err, config: rule }, 'Error setting hostRule from config');
    }
  }
  // host rules can change concurrency
  queue.clear();
  throttle.clear();
  delete config.hostRules;
}

/** needed when using portal secrets for npmToken */
export function setNpmTokenInNpmrc(config: RenovateConfig): void {
  if (!isString(config.npmToken)) {
    return;
  }

  const token = config.npmToken;
  logger.debug({ npmToken: maskToken(token) }, 'Migrating npmToken to npmrc');

  if (!isString(config.npmrc)) {
    logger.debug('Adding npmrc to config');
    config.npmrc = `//registry.npmjs.org/:_authToken=${token}\n`;
    delete config.npmToken;
    return;
  }

  if (config.npmrc.includes(`\${NPM_TOKEN}`)) {
    logger.debug(`Replacing \${NPM_TOKEN} with npmToken`);
    config.npmrc = config.npmrc.replace(regEx(/\${NPM_TOKEN}/g), token);
  } else {
    logger.debug('Appending _authToken= to end of existing npmrc');
    config.npmrc = config.npmrc.replace(
      regEx(/\n?$/),
      `\n_authToken=${token}\n`,
    );
  }

  delete config.npmToken;
}

export async function resolveStaticRepoConfig(
  config: AllConfig,
  filename: string | undefined,
): Promise<AllConfig> {
  if (!isNonEmptyString(filename)) {
    return config;
  }

  let staticRepoConfig: AllConfig;

  try {
    staticRepoConfig = await tryReadStaticRepoFileConfig(filename);
  } catch (err) {
    logger.fatal({ err }, 'Failed to load static repository config file');
    process.exit(1);
  }

  if (!isNonEmptyObject(staticRepoConfig)) {
    return config;
  }

  return mergeStaticConfig(config, staticRepoConfig);
}

export async function tryReadStaticRepoFileConfig(
  staticRepoConfigFile: string,
): Promise<AllConfig> {
  logger.debug(`Reading static repo config file from ${staticRepoConfigFile}`);

  let staticRepoConfigRaw: string;
  try {
    staticRepoConfigRaw = await readSystemFile(staticRepoConfigFile, 'utf8');
  } catch (err) {
    throw new Error(
      `Failed to read static repo config file: "${staticRepoConfigFile}"`,
      { cause: err },
    );
  }

  const staticRepoConfig = parseJson(
    staticRepoConfigRaw,
    staticRepoConfigFile,
  ) as AllConfig;

  // validate and log issues here to preserve context, caller handles migration and full validation.
  const { errors, warnings } = await configValidation.validateConfig(
    'repo',
    staticRepoConfig,
  );

  if (isNonEmptyArray(errors) || isNonEmptyArray(warnings)) {
    logger.info(
      { errors, warnings },
      'Static repo config validation issues detected',
    );
  } else {
    logger.debug(
      { staticRepoConfig },
      'Static repository config file successfully parsed and validated',
    );
  }

  return staticRepoConfig;
}

export function mergeStaticConfig(
  config: AllConfig,
  staticRepoConfig: AllConfig,
): AllConfig {
  // merge extends
  if (isNonEmptyArray(staticRepoConfig.extends)) {
    config.extends = [
      ...staticRepoConfig.extends,
      ...coerceArray(config.extends),
    ];
    delete staticRepoConfig.extends;
  }

  // renovate repo config overrides RENOVATE_STATIC_REPO_CONFIG[_FILE]
  return mergeChildConfig(staticRepoConfig, config);
}

/**
 * Resolve everything but internal Renovate presets and log it out.
 *
* This allows users to understand the fully resolved configuration, including any `github>`, `local>`, etc presets, but excluding anything that's internal to Renovate (which can be verbose and/or less relevant), and provides useful output for debugging purposes.

* This is also known as the "shallow" config.

* Due to caching, this doesn't add any additional requests.
 */
async function logShallowConfig(
  _decryptedConfig: RenovateConfig,
  _config: RepositoryWorkerConfig,
): Promise<void> {
  // make sure we clone the existing config, so we don't modify the existing settings when resolving this in a shallow fashion
  const decryptedConfig = clone(_decryptedConfig);
  const config = clone(_config);

  const { config: resolvedConfig, visitedPresets } =
    await presets.resolveConfigPresets(
      clone(decryptedConfig),
      clone(config),
      [],
      [],
      false,
    );
  logger.debug(
    {
      renovateVersion: pkg.version,
      config: resolvedConfig,
      visitedPresets,
    },
    'Resolved shallow config, without merging internal presets',
  );
}
