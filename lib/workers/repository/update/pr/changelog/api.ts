import { BitbucketChangeLogSource } from './bitbucket/source.ts';
import { BitbucketServerChangeLogSource } from './bitbucket-server/source.ts';
import { ForgejoChangeLogSource } from './forgejo/source.ts';
import { GiteaChangeLogSource } from './gitea/source.ts';
import { GitHubChangeLogSource } from './github/source.ts';
import { GitLabChangeLogSource } from './gitlab/source.ts';
import type { ChangeLogSource } from './source.ts';

const api = new Map<string, ChangeLogSource>();
export default api;

api.set('bitbucket', new BitbucketChangeLogSource());
api.set('bitbucket-server', new BitbucketServerChangeLogSource());
api.set('forgejo', new ForgejoChangeLogSource());
api.set('gitea', new GiteaChangeLogSource());
api.set('github', new GitHubChangeLogSource());
api.set('gitlab', new GitLabChangeLogSource());
