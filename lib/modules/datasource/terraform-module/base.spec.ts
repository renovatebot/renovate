import * as httpMock from '~test/http-mock.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { getPkgReleases } from '../index.ts';
import { TerraformModuleDatasource } from './index.ts';

describe('modules/datasource/terraform-module/base', () => {
  it('throws ExternalHostError for EAI_AGAIN errors', async () => {
    httpMock
      .scope('https://terraform-eai-again.example.com')
      .get('/.well-known/terraform.json')
      .replyWithError(httpMock.error({ code: 'EAI_AGAIN' }));

    await expect(
      getPkgReleases({
        datasource: TerraformModuleDatasource.id,
        packageName: 'hashicorp/consul/aws',
        registryUrls: ['https://terraform-eai-again.example.com'],
      }),
    ).rejects.toThrow(ExternalHostError);
  });

  it('throws ExternalHostError for HTTP 503 errors', async () => {
    httpMock
      .scope('https://terraform-503.example.com')
      .get('/.well-known/terraform.json')
      .reply(503);

    await expect(
      getPkgReleases({
        datasource: TerraformModuleDatasource.id,
        packageName: 'hashicorp/consul/aws',
        registryUrls: ['https://terraform-503.example.com'],
      }),
    ).rejects.toThrow(ExternalHostError);
  });
});
