import { logger, levels, addStream } from '../logger';
import * as definitions from './definitions';
import * as defaultsParser from './defaults';
import * as fileParser from './file';
import * as cliParser from './cli';
import * as envParser from './env';
import { resolveConfigPresets } from './presets';
import { get, getLanguageList, getManagerList } from '../manager';
import { RenovateConfig, RenovateConfigStage } from './common';
import { mergeChildConfig } from './utils';

export * from './common';
export { mergeChildConfig };

export interface ManagerConfig extends RenovateConfig {
  language: string;
  manager: string;
}

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
): Promise<RenovateConfig> {
  logger.debug('Parsing configs');

  // Get configs
  const defaultConfig = await resolveConfigPresets(defaultsParser.getConfig());
  const fileConfig = await resolveConfigPresets(fileParser.getConfig(env));
  const cliConfig = await resolveConfigPresets(cliParser.getConfig(argv));
  const envConfig = await resolveConfigPresets(envParser.getConfig(env));

  let config = mergeChildConfig(fileConfig, envConfig);
  config = mergeChildConfig(config, cliConfig);

  const combinedConfig = config;

  config = mergeChildConfig(defaultConfig, config);

  if (config.prFooter !== defaultConfig.prFooter) {
    config.customPrFooter = true;
  }

  if (config.forceCli) {
    config = mergeChildConfig(config, { force: { ...cliConfig } });
  }

  // Set log level
  levels('stdout', config.logLevel);

  // Add file logger
  // istanbul ignore if
  if (config.logFile) {
    logger.debug(
      `Enabling ${config.logFileLevel} logging to ${config.logFile}`
    );
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
    config.endpoint = config.endpoint.replace(/\/?$/, '/');
  }

  // Remove log file entries
  delete config.logFile;
  delete config.logFileLevel;

  // Move global variables that we need to use later
  const importGlobals = ['prBanner', 'prFooter'];
  config.global = {};
  importGlobals.forEach(key => {
    config.global[key] = config[key];
    delete config[key];
  });
  global.trustLevel = config.trustLevel || 'low';
  delete config.trustLevel;

  return config;
}

export function filterConfig(
  inputConfig: RenovateConfig,
  targetStage: RenovateConfigStage
): RenovateConfig {
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
