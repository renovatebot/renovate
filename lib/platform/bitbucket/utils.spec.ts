import * as httpMock from '../../../test/http-mock';
import { setBaseUrl } from '../../util/http/bitbucket';
import * as utils from './utils';

const range = (count: number) => [...Array(count).keys()];

const baseUrl = 'https://api.bitbucket.org';

describe('accumulateValues()', () => {
  beforeEach(() => {
    httpMock.setup();
    setBaseUrl(baseUrl);
  });

  afterEach(() => {
    httpMock.reset();
  });

  it('paginates', async () => {
    httpMock
      .scope(baseUrl)
      .get('/some-url?pagelen=10')
      .reply(200, {
        values: range(10),
        next:
          'https://api.bitbucket.org/2.0/repositories/?pagelen=10&after=9&role=contributor',
      })
      .get('/2.0/repositories/?pagelen=10&after=9&role=contributor')
      .reply(200, {
        values: range(10),
        next:
          'https://api.bitbucket.org/2.0/repositories/?pagelen=10&after=19&role=contributor',
      })
      .get('/2.0/repositories/?pagelen=10&after=19&role=contributor')
      .reply(200, {
        values: range(5),
      });

    const res = await utils.accumulateValues('some-url', 'get', null, 10);
    expect(res).toHaveLength(25);
    expect(httpMock.getTrace()).toHaveLength(3);
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('isConflicted', () => {
    expect(
      utils.isConflicted([{ chunks: [{ changes: [{ content: '+=======' }] }] }])
    ).toBe(true);
  });
});
