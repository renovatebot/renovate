import type { PlatformId } from '../../constants';
import * as azure from './azure';
import * as bitbucket from './bitbucket';
import * as bitbucketServer from './bitbucket-server';
import * as codecommit from './codecommit';
import * as gitea from './gitea';
import * as github from './github';
import * as gitlab from './gitlab';
import * as local from './local';
import type { Platform } from './types';

const api = new Map<PlatformId, Platform>();
export default api;

api.set(azure.id, azure);
api.set(bitbucket.id, bitbucket);
api.set(bitbucketServer.id, bitbucketServer);
api.set(codecommit.id, codecommit);
api.set(gitea.id, gitea);
api.set(github.id, github);
api.set(gitlab.id, gitlab);
api.set(local.id, local);
