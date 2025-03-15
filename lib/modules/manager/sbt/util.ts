import { regEx } from '../../../util/regex';
import { get } from '../../versioning';
import * as mavenVersioning from '../../versioning/maven';

/*
  https://www.scala-sbt.org/release/docs/Cross-Build.html#Publishing+conventions
 */
export function normalizeScalaVersion(str: string): string {
  // istanbul ignore if
  if (!str) {
    return str;
  }
  const versioning = get(mavenVersioning.id);
  if (versioning.isVersion(str)) {
    // Do not normalize unstable versions
    if (!versioning.isStable(str)) {
      return str;
    }
    // Do not normalize versions prior to 2.10
    if (!versioning.isGreaterThan(str, '2.10.0')) {
      return str;
    }
  }
  const isScala3 = versioning.isGreaterThan(str, '3.0.0');
  if (regEx(/^\d+\.\d+\.\d+$/).test(str)) {
    if (isScala3) {
      return str.replace(regEx(/^(\d+)\.(\d+)\.\d+$/), '$1');
    } else {
      return str.replace(regEx(/^(\d+)\.(\d+)\.\d+$/), '$1.$2');
    }
  }
  // istanbul ignore next
  return str;
}

export function sortPackageFiles(packageFiles: string[]): string[] {
  // process build.sbt first
  const sortedPackageFiles = [...packageFiles];
  const buildSbtIndex = sortedPackageFiles.findIndex((file) =>
    file.endsWith('build.sbt'),
  );
  if (buildSbtIndex !== -1) {
    const buildSbt = sortedPackageFiles.splice(buildSbtIndex, 1)[0];
    sortedPackageFiles.unshift(buildSbt);
  }
  return sortedPackageFiles;
}
