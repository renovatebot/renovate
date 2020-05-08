import { GotResponse } from '../../../platform';
import { api } from '../../../platform/gitlab/gl-got-wrapper';
import * as gitlab from './gitlab';
import { PartialDeep } from 'type-fest';

jest.mock('../../../platform/gitlab/gl-got-wrapper');
jest.mock('../../../util/got');

const glGot: jest.Mock<Promise<PartialDeep<GotResponse>>> = api.get as never;

describe('config/presets/gitlab', () => {
  beforeEach(() => {
    glGot.mockReset();
    return global.renovateCache.rmAll();
  });

  describe('getPresetFromEndpoint()', () => {
    it('uses custom endpoint', async () => {
      await gitlab
        .getPresetFromEndpoint(
          'some/repo',
          'default',
          'https://gitlab.example.org/api/v4'
        )
        .catch((_) => {});
      expect(glGot.mock.calls[0][0]).toEqual(
        'https://gitlab.example.org/api/v4/projects/some%2Frepo/repository/branches'
      );
    });
  });
});
