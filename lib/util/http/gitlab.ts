import parseLinkHeader from 'parse-link-header';
import { PLATFORM_TYPE_GITLAB } from '../../constants/platforms';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { Http, HttpResponse, InternalHttpOptions } from '.';

let baseUrl = 'https://gitlab.com/api/v4/';
export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

interface GitlabInternalOptions extends InternalHttpOptions {
  body?: string;
}

export interface GitlabHttpOptions extends InternalHttpOptions {
  paginate?: boolean;
  token?: string;
}

export class GitlabHttp extends Http<GitlabHttpOptions, GitlabHttpOptions> {
  constructor(options?: GitlabHttpOptions) {
    super(PLATFORM_TYPE_GITLAB, options);
  }

  protected async request<T>(
    url: string | URL,
    options?: GitlabInternalOptions & GitlabHttpOptions
  ): Promise<HttpResponse<T> | null> {
    let result = null;

    const opts = {
      baseUrl,
      ...options,
      throwHttpErrors: true,
    };

    try {
      result = await super.request<T>(url, opts);
      if (opts.paginate) {
        // Check if result is paginated
        try {
          const linkHeader = parseLinkHeader(result.headers.link as string);
          if (linkHeader?.next) {
            result.body = result.body.concat(
              (await this.request<T>(linkHeader.next.url, opts)).body
            );
          }
        } catch (err) /* istanbul ignore next */ {
          logger.warn({ err }, 'Pagination error');
        }
      }
      return result;
    } catch (err) {
      if (err.statusCode === 404) {
        logger.trace({ err }, 'GitLab 404');
        logger.debug({ url: err.url }, 'GitLab API 404');
        throw err;
      }
      logger.debug({ err }, 'Gitlab API error');
      if (
        err.statusCode === 429 ||
        (err.statusCode >= 500 && err.statusCode < 600)
      ) {
        throw new ExternalHostError(err, PLATFORM_TYPE_GITLAB);
      }
      const platformFailureCodes = [
        'EAI_AGAIN',
        'ECONNRESET',
        'ETIMEDOUT',
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      ];
      if (platformFailureCodes.includes(err.code)) {
        throw new ExternalHostError(err, PLATFORM_TYPE_GITLAB);
      }
      if (err.name === 'ParseError') {
        throw new ExternalHostError(err, PLATFORM_TYPE_GITLAB);
      }
      throw err;
    }
  }
}
