import { join } from 'upath';
import { getGlobalConfig } from '../../../config/global';
import { readLocalFile } from '../../../util/fs';
import {
  extractGradleVersion,
  getJavaContraint,
} from '../../gradle-wrapper/utils';

export async function getConstraint(
  gradleRoot: string
): Promise<string | null> {
  if (getGlobalConfig()?.binarySource !== 'docker') {
    // ignore
    return null;
  }

  const fileContent = await readLocalFile(
    join(gradleRoot, 'gradle/wrapper/gradle-wrapper.properties'),
    'utf8'
  );

  const version = extractGradleVersion(fileContent);

  return getJavaContraint(version);
}
