import { GotError } from 'got';

export type HttpError = GotError & {
  statusCode?: number;
};
