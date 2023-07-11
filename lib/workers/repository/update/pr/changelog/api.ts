import { AzureChangeLogSource } from './azure/source';
import { BitbucketChangeLogSource } from './bitbucket/source';
import { GitHubChangeLogSource } from './github/source';
import { GitLabChangeLogSource } from './gitlab/source';
import type { ChangeLogSource } from './source';

const api = new Map<string, ChangeLogSource>();
export default api;

api.set('azure', new AzureChangeLogSource());
api.set('bitbucket', new BitbucketChangeLogSource());
api.set('github', new GitHubChangeLogSource());
api.set('gitlab', new GitLabChangeLogSource());
