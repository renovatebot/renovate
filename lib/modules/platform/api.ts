import type { PlatformId } from '../../constants/index.ts';
import * as azure from './azure/index.ts';
import * as bitbucket from './bitbucket/index.ts';
import * as bitbucketServer from './bitbucket-server/index.ts';
import * as codecommit from './codecommit/index.ts';
import * as forgejo from './forgejo/index.ts';
import * as gerrit from './gerrit/index.ts';
import * as gitea from './gitea/index.ts';
import * as github from './github/index.ts';
import * as gitlab from './gitlab/index.ts';
import * as local from './local/index.ts';
import type { Platform } from './types.ts';

const api = new Map<PlatformId, Platform>();
export default api;

api.set(azure.id, azure);
api.set(bitbucket.id, bitbucket);
api.set(bitbucketServer.id, bitbucketServer);
api.set(codecommit.id, codecommit);
api.set(forgejo.id, forgejo);
api.set(gerrit.id, gerrit);
api.set(gitea.id, gitea);
api.set(github.id, github);
api.set(gitlab.id, gitlab);
api.set(local.id, local);
