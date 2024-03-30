import * as httpMock from '../../../../test/http-mock';
import {PaginatedIterable} from "./paginated-iterator";
import {SpaceHttp} from "../../../util/http/space";

const spaceEndpointUrl = 'https://myorg.jetbrains.space';
const jsonResultHeader = {'content-type': 'application/json;charset=utf-8'};
const urlPath = '/api/http/projects/repositories'

describe('modules/platform/space/paginated-iterator', () => {

  afterEach(() => httpMock.clear())

  const iterable = PaginatedIterable.fromGetUsingNext<TestDto>(new SpaceHttp(spaceEndpointUrl), urlPath)

  const testDto1: TestDto = { text: 'first test dto' }

  const testDto2: TestDto = { text: 'second test dto' }

  const next1 = 'test-next-1'
  const next2 = 'test-next-2'

  describe('plain iterator', () => {
    it('should iterate once over an empty response', async () => {
      mockHttp([])

      const actual = await toArray(iterable)
      expect(actual).toEqual([])
    })

    it('should iterates over first page', async () => {
      // first request
      mockHttp([testDto1, testDto2], { next: next1 })

      // second request
      mockHttp([], { param: next1 })

      const actual = await toArray(iterable)
      expect(actual).toEqual([[testDto1, testDto2]])
    })

    it('should iterates over two pages', async () => {
      // first request
      mockHttp([testDto1], { next: next1 })

      // second request
      mockHttp([testDto2], { param: next1, next: next2 })

      // third request
      mockHttp([], { param: next2 })

      const actual = await toArray(iterable)
      expect(actual).toEqual([[testDto1], [testDto2]])
    })

    it('should use parametrized field names', async () => {
      // page 1
      httpMock
        .scope(spaceEndpointUrl)
        .get(urlPath)
        .reply(200, {
            myNextField: next1,
            myDataField: [testDto1]
          },
          jsonResultHeader,
        );

      // page 2
      httpMock
        .scope(spaceEndpointUrl)
        .get(`${urlPath}?myNextParam=${next1}`)
        .reply(200, {
            myNextField: next2,
            myDataField: [testDto2]
          },
          jsonResultHeader,
        );

      // final page
      httpMock
        .scope(spaceEndpointUrl)
        .get(`${urlPath}?myNextParam=${next2}`)
        .reply(200, {
            myNextField: 'whatever',
            myDataField: []
          },
          jsonResultHeader,
        );

      const iterableWithCustomFieldNames = PaginatedIterable.fromUsing<TestDto>(new SpaceHttp(spaceEndpointUrl), urlPath, {
        queryParameter: 'myNextParam',
        dataField: it => it.myDataField,
        nextField: it => it.myNextField
      })

      const actual = await toArray(iterableWithCustomFieldNames)
      expect(actual).toEqual([[testDto1], [testDto2]])
    });

    it('should not fails with empty response is missing', async () => {
      // first request
      mockHttp([testDto1], { next: next1 })

      // empty response with invalid query param
      mockHttp([], { param: next1, status: 404 })

      await expect(async () => await toArray(iterable)).rejects.toThrow()
    })
  })
});

interface TestDto {
  text: string
}

async function toArray<T>(asyncIterable: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = []
  for await (const it of asyncIterable) {
    result.push(it)
  }
  return result
}

function mockHttp(data: TestDto[], config: HttpMockConfig = {}) {
  let path = urlPath
  if (config.param) {
    path += `?next=${config.param}`
  }

  httpMock
    .scope(spaceEndpointUrl)
    .get(path)
    .reply(config.status ?? 200, {
        next: config.next ?? 'random-whatever',
        data
      },
      jsonResultHeader,
    );
}

interface HttpMockConfig {
  param?: string
  next?: string,
  status?: number
}
