import { GradleVersionDatasource } from '../../datasource/gradle-version';
import { JavaVersionDatasource } from '../../datasource/java-version';
import { MavenDatasource } from '../../datasource/maven';
import * as ivyVersioning from '../../versioning/ivy';

export function depNameToDatasource(depName: string): string | null {
  // There are so many that I'm only listing the main ones.
  // For most people, this setup will be enough.
  switch (depName) {
    case 'java':
      return JavaVersionDatasource.id;
    case 'maven':
      return MavenDatasource.id;
    case 'gradle':
      return GradleVersionDatasource.id;
    case 'sbt':
      return ivyVersioning.id;
  }
  return null;
}
