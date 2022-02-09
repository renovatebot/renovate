import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { localPathExists, readLocalFile } from '../../../util/fs';
import {
  extractGradleVersion,
  getJavaContraint,
} from '../../gradle-wrapper/utils';

const GradleWrapperProperties = 'gradle/wrapper/gradle-wrapper.properties';

export async function getDockerConstraint(
  gradleRoot: string
): Promise<string | null> {
  if (GlobalConfig.get('binarySource') !== 'docker') {
    // ignore
    return null;
  }

  const fileContent = await readLocalFile(
    upath.join(gradleRoot, GradleWrapperProperties),
    'utf8'
  );

  const version = extractGradleVersion(fileContent)?.version;

  return getJavaContraint(version);
}

export async function getDockerPreCommands(
  gradleRoot: string
): Promise<string[]> {
  if (GlobalConfig.get('binarySource') !== 'docker') {
    // ignore
    return null;
  }

  if (await localPathExists(upath.join(gradleRoot, GradleWrapperProperties))) {
    return null;
  }

  return ['install-tool gradle latest'];
}
