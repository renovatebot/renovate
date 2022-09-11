import is from '@sindresorhus/is';
import type { Credentials } from 'aws4';
import * as aws4 from 'aws4';
import { REPOSITORY_UNINITIATED } from '../../../constants/error-messages';

export function getCodeCommitUrl(
  region: string,
  repoName: string,
  credentials: Credentials
): string {
  const signer = new aws4.RequestSigner(
    {
      service: 'codecommit',
      host: `git-codecommit.${region}.amazonaws.com`,
      method: 'GIT',
      path: `v1/repos/${repoName}`,
    },
    credentials
  );
  const dateTime = signer.getDateTime();

  /* istanbul ignore if */
  if (!is.string(dateTime)) {
    throw new Error(REPOSITORY_UNINITIATED);
  }

  const accessKeyId = credentials.accessKeyId!;
  const token: string = dateTime + 'Z' + signer.signature();

  let username = `${accessKeyId}${
    credentials.sessionToken ? `%${credentials.sessionToken}` : ''
  }\n`;

  // these modifications to username are only in case session token exists,
  // and it's not supposed to work with renovate since it's a temporary token

  // istanbul ignore if
  if (username.includes('\n')) {
    username = username.replace(/\n|\r/g, '');
  }
  // istanbul ignore if
  if (username.includes('/')) {
    username = username.replace(/\//g, '%2F');
  }
  return `https://${username}:${token}@git-codecommit.${region}.amazonaws.com/v1/repos/${repoName}`;
}
