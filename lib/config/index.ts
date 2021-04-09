import { addStream, levels, logger, setContext } from '../logger';
import { get, getLanguageList, getManagerList } from '../manager';
import { ensureDir, getSubDirectory, readFile } from '../util/fs';
import { ensureTrailingSlash } from '../util/url';
import * as cliParser from './cli';
import * as defaultsParser from './defaults';
import * as definitions from './definitions';
import * as envParser from './env';
import * as fileParser from './file';
import { resolveConfigPresets } from './presets';
import type {
  GlobalConfig,
  ManagerConfig,
  RenovateConfig,
  RenovateConfigStage,
} from './types';
import { mergeChildConfig } from './utils';

export * from './types';
export { mergeChildConfig };

export function getManagerConfig(
  config: RenovateConfig,
  manager: string
): ManagerConfig {
  let managerConfig: ManagerConfig = {
    ...config,
    language: null,
    manager: null,
  };
  const language = get(manager, 'language');
  if (language) {
    managerConfig = mergeChildConfig(managerConfig, config[language]);
  }
  managerConfig = mergeChildConfig(managerConfig, config[manager]);
  for (const i of getLanguageList().concat(getManagerList())) {
    delete managerConfig[i];
  }
  managerConfig.language = language;
  managerConfig.manager = manager;
  return managerConfig;
}

export async function parseConfigs(
  env: NodeJS.ProcessEnv,
  argv: string[]
): Promise<GlobalConfig> {
  logger.debug('Parsing configs');

  // Get configs
  const defaultConfig = await resolveConfigPresets(defaultsParser.getConfig());
  const fileConfig = await resolveConfigPresets(fileParser.getConfig(env));
  const cliConfig = await resolveConfigPresets(cliParser.getConfig(argv));
  const envConfig = await resolveConfigPresets(envParser.getConfig(env));

  let config: GlobalConfig = mergeChildConfig(fileConfig, envConfig);
  config = mergeChildConfig(config, cliConfig);

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
    config.privateKey = await readFile(config.privateKeyPath);
    delete config.privateKeyPath;
  }

  // Deprecated set log level: https://github.com/renovatebot/renovate/issues/8291
  // istanbul ignore if
  if (config.logLevel) {
    logger.warn(
      'Configuring logLevel in CLI or file is deprecated. Use LOG_LEVEL environment variable instead'
    );
    levels('stdout', config.logLevel);
  }

  if (config.logContext) {
    // This only has an effect if logContext was defined via file or CLI, otherwise it would already have been detected in env
    setContext(config.logContext);
  }

  // Add file logger
  // istanbul ignore if
  if (config.logFile) {
    logger.debug(
      `Enabling ${config.logFileLevel} logging to ${config.logFile}`
    );
    await ensureDir(getSubDirectory(config.logFile));
    addStream({
      name: 'logfile',
      path: config.logFile,
      level: config.logFileLevel,
    });
  }

  logger.trace({ config: defaultConfig }, 'Default config');
  logger.debug({ config: fileConfig }, 'File config');
  logger.debug({ config: cliConfig }, 'CLI config');
  logger.debug({ config: envConfig }, 'Env config');
  logger.debug({ config: combinedConfig }, 'Combined config');

  // Get global config
  logger.trace({ config }, 'Full config');

  // Print config
  logger.trace({ config }, 'Global config');

  // Massage endpoint to have a trailing slash
  if (config.endpoint) {
    logger.debug('Adding trailing slash to endpoint');
    config.endpoint = ensureTrailingSlash(config.endpoint);
  }

  // Remove log file entries
  delete config.logFile;
  delete config.logFileLevel;

  return config;
}

export function filterConfig(
  inputConfig: GlobalConfig,
  targetStage: RenovateConfigStage
): GlobalConfig {
  logger.trace({ config: inputConfig }, `filterConfig('${targetStage}')`);
  const outputConfig: RenovateConfig = { ...inputConfig };
  const stages = ['global', 'repository', 'package', 'branch', 'pr'];
  const targetIndex = stages.indexOf(targetStage);
  for (const option of definitions.getOptions()) {
    const optionIndex = stages.indexOf(option.stage);
    if (optionIndex !== -1 && optionIndex < targetIndex) {
      delete outputConfig[option.name];
    }
  }
  return outputConfig;
}
