/**
 * https://docs.atlassian.com/bitbucket-server/rest/5.16.0/bitbucket-rest.html#idm8297065392
 */
export interface FileData {
  isLastPage: boolean;

  lines: { text: string }[];

  size: number;
}
