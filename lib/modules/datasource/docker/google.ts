import { GoogleAuth } from "google-auth-library"
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { addSecretForSanitizing } from '../../../util/sanitize';

export const googleRegex = regEx(/([a-z-]+\.)?(gcr.io|pkg.dev)/);

export async function getGoogleAccessToken(): Promise<string | null> {
  const googleAuth: GoogleAuth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
  })
  const client = await googleAuth.getClient();
  try {
    const data = await client.getAccessToken()
    const accessToken = data.token
    if (accessToken) {
      // sanitize token
      addSecretForSanitizing(accessToken);
      return accessToken;
    }
    logger.warn(
      'Could not extract access token from google getAccessToken response'
    );
  } catch (err) {
    logger.trace({ err }, 'err');
    logger.debug('google getAccessToken error');
  }
  return null;
}
