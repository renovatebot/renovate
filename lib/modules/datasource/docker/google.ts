import { GoogleAuth } from 'google-auth-library';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { addSecretForSanitizing } from '../../../util/sanitize';

export const googleRegex = regEx(
  /(((eu|us|asia)\.)?gcr\.io|[a-z0-9-]+-docker\.pkg\.dev)/
);

export async function getGoogleAccessToken(): Promise<string | null> {
  const googleAuth: GoogleAuth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform',
  });
  const accessToken = await googleAuth.getAccessToken();
  if (accessToken) {
    // sanitize token
    addSecretForSanitizing(accessToken);
    return accessToken;
  }
  logger.warn(
    'Could not retrieve access token using google-auth-library getAccessToken'
  );
  return null;
}
