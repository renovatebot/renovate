import is from '@sindresorhus/is';
import { GoogleAuth } from 'google-auth-library';
import { logger } from '../../logger';
import type { HttpResponse } from '../../util/http/types';
import { addSecretForSanitizing } from '../../util/sanitize';

const JFROG_ARTIFACTORY_RES_HEADER = 'x-jfrog-version';

export function isArtifactoryServer<T = unknown>(
  res: HttpResponse<T> | undefined,
): boolean {
  return is.string(res?.headers[JFROG_ARTIFACTORY_RES_HEADER]);
}

export async function getGoogleAuthToken(): Promise<string | null> {
  try {
    const googleAuth: GoogleAuth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });
    const accessToken = await googleAuth.getAccessToken();
    if (accessToken) {
      // sanitize token
      addSecretForSanitizing(accessToken);
      return Buffer.from(`oauth2accesstoken:${accessToken}`).toString('base64');
    } else {
      logger.warn(
        'Could not retrieve access token using google-auth-library getAccessToken',
      );
    }
  } catch (err) {
    if (err.message?.includes('Could not load the default credentials')) {
      return null;
    } else {
      throw err;
    }
  }
  return null;
}
