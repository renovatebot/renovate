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
  if (!is.string(dateTime)) {
    throw new Error(REPOSITORY_UNINITIATED);
  }

  const token: string = dateTime + 'Z' + signer.signature();
  return `https://${credentials.accessKeyId}:${token}@git-codecommit.${region}.amazonaws.com/v1/repos/${repoName}`;
}

export function getNewBranchName(branchName?: string): string | undefined {
  if (branchName && !branchName.startsWith('refs/heads/')) {
    return `refs/heads/${branchName}`;
  }
  return branchName;
}
