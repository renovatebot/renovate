import { BitbucketChangeLogSource } from './bitbucket/source';
import { GitHubChangeLogSource } from './github/source';
import type { ChangeLogSource } from './source';
import { GitLabChangeLogSource } from './source-gitlab';

const api = new Map<string, ChangeLogSource>();
export default api;

api.set('bitbucket', new BitbucketChangeLogSource());
api.set('github', new GitHubChangeLogSource());
api.set('gitlab', new GitLabChangeLogSource());
