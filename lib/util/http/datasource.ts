/* eslint-disable max-classes-per-file */
import { MemCacheBucket } from '../cache/memory';
import { GithubHttp as BaseGithubHttp } from './github';
import { GitlabHttp as BaseGitlabHttp } from './gitlab';
import {
  Http as BaseHttp,
  HttpOptions as BaseHttpOptions,
  HttpResponse as BaseHttpResponse,
} from '.';

export type HttpOptions = BaseHttpOptions;
export type HttpResponse = BaseHttpResponse;
export { HttpError } from '.';

export class Http extends BaseHttp {
  protected cacheBucket = MemCacheBucket.datasource;
}

export class GitlabHttp extends BaseGitlabHttp {
  protected cacheBucket = MemCacheBucket.datasource;
}

export class GithubHttp extends BaseGithubHttp {
  protected cacheBucket = MemCacheBucket.datasource;
}
