import { Http } from '../../util/http';

export const id = 'go';

export const http = new Http(id);

export enum GoproxyFallback {
  WhenNotFoundOrGone = ',',
  Always = '|',
}
