import * as httpMock from '../../../test/httpMock';
import * as utils from './utils';

const range = (count: number) => [...Array(count).keys()];

describe('accumulateValues()', () => {
  it('paginates', async () => {
    httpMock.reset();
    httpMock.setup();

    httpMock
      .scope('https://api.bitbucket.org')
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
});
