import { Readable } from 'stream';
import { getName, mocked } from '../../../../test/util';
import { setPlatformApi } from '../../../platform';
import * as _azureApi from '../../../platform/azure/azure-got-wrapper';
import { PRESET_DEP_NOT_FOUND, PRESET_INVALID_JSON } from '../util';
import * as azure from '.';

jest.unmock('../../../platform');
jest.mock('../../../platform/azure/azure-got-wrapper');

const azureApi = mocked(_azureApi);

describe(getName(__filename), () => {
  beforeAll(() => {
    setPlatformApi('azure');
  });

  describe('fetchJSONFile()', () => {
    it('returns JSON', async () => {
      const data = { foo: 'bar' };
      const azureApiMock = {
        getItemContent: jest.fn(() =>
          Promise.resolve(Readable.from(JSON.stringify(data)))
        ),
        getRepositories: jest.fn(() =>
          Promise.resolve([
            { id: '123456', name: 'repo', project: { name: 'some' } },
          ])
        ),
      };
      azureApi.gitApi.mockImplementationOnce(() => azureApiMock as any);

      const res = await azure.fetchJSONFile('some/repo', 'some-filename.json');
      expect(res).toEqual(data);
      expect(azureApiMock.getItemContent.mock.calls).toMatchSnapshot();
    });

    it('throws on error', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getItemContent: jest.fn(() => {
              throw new Error('unknown');
            }),
            getRepositories: jest.fn(() =>
              Promise.resolve([
                { id: '123456', name: 'repo', project: { name: 'some' } },
              ])
            ),
          } as any)
      );
      await expect(
        azure.fetchJSONFile('some/repo', 'some-filename.json')
      ).rejects.toThrow(PRESET_DEP_NOT_FOUND);
    });

    it('throws on invalid json', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getItemContent: jest.fn(() =>
              Promise.resolve(Readable.from('!@#'))
            ),
            getRepositories: jest.fn(() =>
              Promise.resolve([
                { id: '123456', name: 'repo', project: { name: 'some' } },
              ])
            ),
          } as any)
      );

      await expect(
        azure.fetchJSONFile('some/repo', 'some-filename.json')
      ).rejects.toThrow(PRESET_INVALID_JSON);
    });
  });

  describe('getPresetFromEndpoint()', () => {
    it('uses custom path', async () => {
      const data = { foo: 'bar' };
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getItemContent: jest.fn(() =>
              Promise.resolve(Readable.from(JSON.stringify(data)))
            ),
            getRepositories: jest.fn(() =>
              Promise.resolve([
                { id: '123456', name: 'repo', project: { name: 'some' } },
              ])
            ),
          } as any)
      );
      const res = await azure.getPresetFromEndpoint(
        'some/repo',
        'some-filename',
        'foo/bar',
        ''
      );
      expect(res).toEqual(data);
    });
  });
});
