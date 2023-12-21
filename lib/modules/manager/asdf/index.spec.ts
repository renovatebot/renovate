import { StaticTooling, upgradeableTooling } from './upgradeable-tooling';
import { extractPackageFile, supportedDatasources } from '.';

describe('modules/manager/asdf/index', () => {
  describe('supportedDatasources', () => {
    const toolConfigs = [
      ...Object.values(upgradeableTooling)
        .map((definition) => definition.config)
        .filter((config): config is StaticTooling => 'datasource' in config),
      ...extractPackageFile(`java adoptopenjdk-16.0.0+36
java adoptopenjdk-jre-16.0.0+36
scala 2.0.0
scala 3.0.0`)!.deps,
    ];

    const usedDatasources = new Set(
      toolConfigs.map((config) => config.datasource!),
    );

    for (const datasource of usedDatasources) {
      it(`contains ${datasource}`, () => {
        expect(supportedDatasources).toContain(datasource);
      });
    }
  });
});
