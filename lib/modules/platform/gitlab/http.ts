import { logger } from '../../../logger';
import { GitlabHttp } from '../../../util/http/gitlab';
import type { GitlabUserStatus } from './types';

export const gitlabApi = new GitlabHttp();

export async function getUserID(username: string): Promise<number> {
  return (
    await gitlabApi.getJson<{ id: number }[]>(`users?username=${username}`)
  ).body[0].id;
}

export async function isUserBusy(user: string): Promise<boolean> {
  try {
    const url = `/users/${user}/status`;
    const userStatus = (await gitlabApi.getJson<GitlabUserStatus>(url)).body;
    return userStatus.availability === 'busy';
  } catch (err) {
    logger.warn({ err }, 'Failed to get user status');
    return false;
  }
}
