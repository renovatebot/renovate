import { isNonEmptyArray, isNonEmptyObject } from '@sindresorhus/is';
import { setUserConfigFileNames } from '../../../../config/app-strings.ts';
import { setPrivateKeys } from '../../../../config/decrypt.ts';
import * as defaultsParser from '../../../../config/defaults.ts';
import { resolveConfigPresets } from '../../../../config/presets/index.ts';
import { applySecretsAndVariablesToConfig } from '../../../../config/secrets.ts';
import type { AllConfig } from '../../../../config/types.ts';
import { mergeChildConfig } from '../../../../config/utils.ts';
import { CONFIG_PRESETS_INVALID } from '../../../../constants/error-messages.ts';
import { logger, setContext } from '../../../../logger/index.ts';
import { detectAllGlobalConfig } from '../../../../modules/manager/index.ts';
import { coerceArray } from '../../../../util/array.ts';
import { setCustomEnv } from '../../../../util/env.ts';
import { readSystemFile } from '../../../../util/fs/index.ts';
import { addSecretForSanitizing } from '../../../../util/sanitize.ts';
import { ensureTrailingSlash } from '../../../../util/url.ts';
import * as additionalConfigFileParser from './additional-config-file.ts';
import * as cliParser from './cli.ts';
import * as codespaces from './codespaces.ts';
import * as envParser from './env.ts';
import * as fileParser from './file.ts';
import { hostRulesFromEnv } from './host-rules-from-env.ts';

export async function resolveGlobalExtends(
  globalExtends: string[],
  ignorePresets?: string[],
): Promise<AllConfig> {
  try {
    // Make a "fake" config to pass to resolveConfigPresets and resolve globalPresets
    const config = { extends: globalExtends, ignorePresets };
    const { config: resolvedConfig } = await resolveConfigPresets(config);
    return resolvedConfig;
  } catch (err) {
    logger.error({ err }, 'Error resolving config preset');
    throw new Error(CONFIG_PRESETS_INVALID);
  }
}

export async function parseConfigs(
  env: NodeJS.ProcessEnv,
  argv: string[],
): Promise<AllConfig> {
  logger.debug('Parsing configs');

  // Get configs
  const defaultConfig = defaultsParser.getConfig();
  const fileConfig = await fileParser.getConfig(env);
  const additionalFileConfig = await additionalConfigFileParser.getConfig(env);
  const cliConfig = cliParser.getConfig(argv);
  const envConfig = await envParser.getConfig(env);

  let config: AllConfig = mergeChildConfig(fileConfig, additionalFileConfig);
  // merge extends from file config and additional file config
  if (
    isNonEmptyArray(fileConfig.extends) &&
    isNonEmptyArray(additionalFileConfig.extends)
  ) {
    config.extends = [...fileConfig.extends, ...(config.extends ?? [])];
  }
  config = mergeChildConfig(config, envConfig);
  config = mergeChildConfig(config, cliConfig);

  config = await codespaces.setConfig(config);

  let resolvedGlobalExtends: AllConfig | undefined;

  if (isNonEmptyArray(config?.globalExtends)) {
    // resolve global presets immediately
    resolvedGlobalExtends = await resolveGlobalExtends(
      config.globalExtends,
      config.ignorePresets,
    );
    config = mergeChildConfig(resolvedGlobalExtends, config);
    delete config.globalExtends;
  }

  const combinedConfig = config;

  config = mergeChildConfig(defaultConfig, config);

  if (config.forceCli) {
    const forcedCli = { ...cliConfig };
    delete forcedCli.token;
    delete forcedCli.hostRules;
    if (config.force) {
      config.force = { ...config.force, ...forcedCli };
    } else {
      config.force = forcedCli;
    }
  }

  if (!config.privateKey && config.privateKeyPath) {
    config.privateKey = await readSystemFile(config.privateKeyPath, 'utf8');
    delete config.privateKeyPath;
  }

  if (!config.privateKeyOld && config.privateKeyPathOld) {
    config.privateKeyOld = await readSystemFile(
      config.privateKeyPathOld,
      'utf8',
    );
    delete config.privateKeyPathOld;
  }

  // Add private keys for sanitizing then set and delete them
  addSecretForSanitizing(config.privateKey, 'global');
  addSecretForSanitizing(config.privateKeyOld, 'global');
  setPrivateKeys(config.privateKey, config.privateKeyOld);
  delete config.privateKey;
  delete config.privateKeyOld;

  if (config.logContext) {
    // This only has an effect if logContext was defined via file or CLI, otherwise it would already have been detected in env
    setContext(config.logContext);
  }

  logger.trace({ config: defaultConfig }, 'Default config');
  logger.debug({ config: fileConfig }, 'File config');
  logger.debug({ config: additionalFileConfig }, 'Additional file config');
  logger.debug({ config: cliConfig }, 'CLI config');
  logger.debug({ config: envConfig }, 'Env config');
  logger.debug({ config: resolvedGlobalExtends }, 'Resolved global extends');
  logger.debug({ config: combinedConfig }, 'Combined config');

  if (config.detectGlobalManagerConfig) {
    logger.debug('Detecting global manager config');
    const globalManagerConfig = await detectAllGlobalConfig();
    logger.debug({ config: globalManagerConfig }, 'Global manager config');
    config = mergeChildConfig(config, globalManagerConfig);
  }

  if (config.detectHostRulesFromEnv) {
    const hostRules = hostRulesFromEnv(env);
    config.hostRules = [...coerceArray(config.hostRules), ...hostRules];
  }
  // Get global config
  logger.trace({ config }, 'Full config');

  // Massage endpoint to have a trailing slash
  if (config.endpoint) {
    logger.debug('Adding trailing slash to endpoint');
    config.endpoint = ensureTrailingSlash(config.endpoint);
  }

  // Massage forkProcessing
  if (!config.autodiscover && config.forkProcessing !== 'disabled') {
    logger.debug('Enabling forkProcessing while in non-autodiscover mode');
    config.forkProcessing = 'enabled';
  }

  // Only try deletion if RENOVATE_CONFIG_FILE is set
  await fileParser.deleteNonDefaultConfig(env, !!config.deleteConfigFile);

  // Only try deletion if RENOVATE_ADDITIONAL_CONFIG_FILE is set
  await additionalConfigFileParser.deleteNonDefaultConfig(
    env,
    !!config.deleteAdditionalConfigFile,
  );

  // Massage onboardingNoDeps
  if (!config.autodiscover && config.onboardingNoDeps !== 'disabled') {
    logger.debug('Enabling onboardingNoDeps while in non-autodiscover mode');
    config.onboardingNoDeps = 'enabled';
  }

  // do not add these secrets to repoSecrets and,
  //  do not delete the secrets/variables object after applying on global config as it needs to be re-used for repo config
  if (isNonEmptyObject(config.secrets) || isNonEmptyObject(config.variables)) {
    config = applySecretsAndVariablesToConfig({
      config,
      secrets: config.secrets,
      variables: config.variables,
      deleteSecrets: false,
      deleteVariables: false,
    });
    // adding these secrets to the globalSecrets set so that they can be redacted from logs
    for (const secret of Object.values(config.secrets!)) {
      addSecretForSanitizing(secret, 'global');
    }
  }

  if (isNonEmptyObject(config.customEnvVariables)) {
    setCustomEnv(config.customEnvVariables);
  }

  if (isNonEmptyArray(config.configFileNames)) {
    logger.debug(
      { configFileNames: config.configFileNames },
      'Updated the config filenames list',
    );
    setUserConfigFileNames(config.configFileNames);
    delete config.configFileNames;
  }

  return config;
}
