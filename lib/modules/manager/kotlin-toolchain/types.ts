import type { VersionCatalogManagerData } from '../../../util/gradle-version-catalog/types.ts';

export interface KotlinToolchainManagerData extends VersionCatalogManagerData {
  replacePrefix?: string;
  replaceSuffix?: string;
  settingPath?: string;
}
