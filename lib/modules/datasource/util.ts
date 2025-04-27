import is from '@sindresorhus/is';
import { GoogleAuth } from 'google-auth-library';
import { logger } from '../../logger';
import type { HostRule } from '../../types';
import type { HttpResponse } from '../../util/http/types';
import { addSecretForSanitizing } from '../../util/sanitize';

const JFROG_ARTIFACTORY_RES_HEADER = 'x-jfrog-version';

export function isArtifactoryServer<T = unknown>(
  res: HttpResponse<T> | undefined,
): boolean {
  return is.string(res?.headers[JFROG_ARTIFACTORY_RES_HEADER]);
}

export async function getGoogleAuthHostRule(): Promise<HostRule | null> {
  try {
    const googleAuth: GoogleAuth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });
    const accessToken = await googleAuth.getAccessToken();
    if (accessToken) {
      // sanitize token
      addSecretForSanitizing(accessToken);
      return {
        username: 'oauth2accesstoken',
        password: accessToken,
      };
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

export async function getGoogleAuthToken(): Promise<string | null> {
  const rule = await getGoogleAuthHostRule();
  if (rule) {
    const token = Buffer.from(`${rule.username}:${rule.password}`).toString(
      'base64',
    );
    addSecretForSanitizing(token);
    return token;
  }
  return null;
}
