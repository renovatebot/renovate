import { Http } from '../../util/http';
import { BitBucketTagsDatasource } from '../bitbucket-tags';

export const id = 'go';

export const http = new Http(id);

export const bitbucket = new BitBucketTagsDatasource();

export enum GoproxyFallback {
  WhenNotFoundOrGone = ',',
  Always = '|',
}
