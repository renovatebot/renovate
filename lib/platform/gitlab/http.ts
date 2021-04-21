import { GitlabHttp } from '../../util/http/gitlab';

export const gitlabApi = new GitlabHttp();

export async function getUserID(username: string): Promise<number> {
  return (
    await gitlabApi.getJson<{ id: number }[]>(`users?username=${username}`)
  ).body[0].id;
}
