import { parseUrl } from '../url';
import { executeSynchronousGetRequest } from './sync';

type HttpResponse = {
  statusCode: number;
  description: string;
};

describe('util/http/sync', () => {
  const failingUrl = parseUrl('https://mock.codes/404');
  const url = parseUrl('https://mock.codes');

  it('should return null if url is not defined', () => {
    const result = executeSynchronousGetRequest(null);
    expect(result).toBeNull();
  });

  it('should return null if URL returns 404', () => {
    const result = executeSynchronousGetRequest(failingUrl);
    expect(result).toBeNull();
  });

  it('should return response', () => {
    const result: HttpResponse = JSON.parse(executeSynchronousGetRequest(url)!);
    expect(result.statusCode).toBe(200);
    expect(result.description).toBeNonEmptyString();
  });

  it('should return null on timeout', () => {
    const result = executeSynchronousGetRequest(url, {
      timeout: 1,
      socketTimeout: 1,
    });
    expect(result).toBeNull();
  });
});
