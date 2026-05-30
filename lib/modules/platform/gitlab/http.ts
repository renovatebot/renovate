import { isEmptyArray } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { GitlabHttp } from '../../../util/http/gitlab.ts';
import { LooseArray } from '../../../util/schema-utils/index.ts';
import { GitlabUserSchema, GitlabUserStatusSchema } from './schema.ts';

export const gitlabApi = new GitlabHttp();

export async function getUserID(username: string): Promise<number> {
  const userInfo = (
    await gitlabApi.getJson(
      `users?username=${username}`,
      LooseArray(GitlabUserSchema).catch([]),
    )
  ).body;

  if (isEmptyArray(userInfo)) {
    throw new Error(
      `User ID for the username: ${username} could not be found.`,
    );
  }

  return userInfo[0].id;
}

async function getMembers(
  group: string,
): Promise<{ id: number; username: string }[]> {
  const groupEncoded = encodeURIComponent(group);
  return (
    await gitlabApi.getJson(
      `groups/${groupEncoded}/members`,
      LooseArray(GitlabUserSchema).catch([]),
    )
  ).body;
}

export async function getMemberUserIDs(group: string): Promise<number[]> {
  try {
    const members = await getMembers(group);
    return members.map((u) => u.id);
  } catch (err) {
    logger.once.warn(
      { group, errorMessage: err.message },
      `Unable to fetch user IDs for members of the ${group} group`,
    );
    return [];
  }
}

export async function getMemberUsernames(group: string): Promise<string[]> {
  const members = await getMembers(group);
  return members.map((u) => u.username);
}

export async function isUserBusy(user: string): Promise<boolean> {
  try {
    const url = `/users/${user}/status`;
    const userStatus = (await gitlabApi.getJson(url, GitlabUserStatusSchema))
      .body;
    return userStatus.availability === 'busy';
  } catch (err) {
    logger.warn({ err }, 'Failed to get user status');
    return false;
  }
}
