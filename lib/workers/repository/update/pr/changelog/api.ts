import { BitbucketChangeLogSource } from './bitbucket/source';
import { BitbucketServerChangeLogSource } from './bitbucket-server/source';
import { ForgejoChangeLogSource } from './forgejo/source';
import { GiteaChangeLogSource } from './gitea/source';
import { GitHubChangeLogSource } from './github/source';
import { GitLabChangeLogSource } from './gitlab/source';
import type { ChangeLogSource } from './source';

const api = new Map<string, ChangeLogSource>();
export default api;

api.set('bitbucket', new BitbucketChangeLogSource());
api.set('bitbucket-server', new BitbucketServerChangeLogSource());
api.set('forgejo', new ForgejoChangeLogSource());
api.set('gitea', new GiteaChangeLogSource());
api.set('github', new GitHubChangeLogSource());
api.set('gitlab', new GitLabChangeLogSource());
