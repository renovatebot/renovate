import type { SpaceHttp } from '../../../util/http/space';

/**
 * Asynchronous iterator that can perform some extra operations over received data as it is fetched
 */
export class PaginatedIterable<T> implements AsyncIterable<T[]> {
  constructor(
    private nextPage: (next?: string) => Promise<any>,
    private config: PaginatedIterableConfig,
  ) {}

  [Symbol.asyncIterator](): AsyncIterator<T[]> {
    return new PaginatedIterator(this.nextPage, this.config);
  }

  static fromGetUsingNext<T>(
    http: SpaceHttp,
    basePath: string,
  ): PaginatedIterable<T> {
    return this.fromUsing(http, basePath, {
      queryParameter: 'next',
      dataField: (it) => it.data,
      nextField: (it) => it.next,
    });
  }

  static fromGetUsingSkip<T>(
    http: SpaceHttp,
    basePath: string,
  ): PaginatedIterable<T> {
    return this.fromUsing(http, basePath, {
      queryParameter: '$skip',
      dataField: (it) => it.data,
      nextField: (it) => it.next,
    });
  }

  static fromUsing<T>(
    http: SpaceHttp,
    basePath: string,
    config: PaginatedIterableConfig,
  ): PaginatedIterable<T> {
    const hasQuery = basePath.includes('?');

    const encodedQueryParameter = encodeURIComponent(config.queryParameter);

    return new PaginatedIterable<T>(async (next?: string) => {
      let path = basePath;
      if (next) {
        const encodedNext = encodeURIComponent(next);
        if (hasQuery) {
          path += `&${encodedQueryParameter}=${encodedNext}`;
        } else {
          path += `?${encodedQueryParameter}=${encodedNext}`;
        }
      }

      const result = await http.getJson<any>(path);
      return result.body;
    }, config);
  }
}

class PaginatedIterator<T> implements AsyncIterator<T[]> {
  private nextQuery?: string = undefined;

  constructor(
    private nextPage: (next?: string) => Promise<any>,
    private config: PaginatedIteratorConfig,
  ) {}

  async next(): Promise<IteratorResult<T[]>> {
    const result = await this.nextPage(this.nextQuery);

    this.nextQuery = this.config.nextField(result);

    const data = this.config.dataField(result) as T[];
    return Promise.resolve({
      value: data,
      done: data.length === 0,
    });
  }
}

interface PaginatedIterableConfig extends PaginatedIteratorConfig {
  queryParameter: string;
}

interface PaginatedIteratorConfig {
  nextField: (val: any) => string;
  dataField: (val: any) => any[];
}
