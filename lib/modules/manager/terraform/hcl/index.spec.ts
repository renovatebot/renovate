import { Fixtures } from '../../../../../test/fixtures';
import { parseHCL, parseJSON } from './index';

const modulesTF = Fixtures.get('modules.tf');
const resourcesTF = Fixtures.get('resources.tf');
const resourcesTFJSON = Fixtures.get('resources.tf.json');
const lockedVersion = Fixtures.get('lockedVersion.tf');

describe('modules/manager/terraform/hcl/index', () => {
  describe('parseHCL()', () => {
    it('should return flat modules', async () => {
      const res = await parseHCL(modulesTF, 'file.tf');
      expect(res?.module).toBeDefined();
      expect(Object.keys(res!.module!)).toBeArrayOfSize(6);
      expect(res).toMatchObject({
        module: {
          bar: [
            {
              source: 'github.com/hashicorp/example?ref=next',
            },
          ],
          consul: [
            {
              source: 'hashicorp/consul/aws',
              version: '0.1.0',
            },
          ],
          foo: [
            {
              source: 'github.com/hashicorp/example?ref=v1.0.0',
            },
          ],
          'repo-with-dot': [
            {
              source: 'github.com/hashicorp/example.2.3?ref=v1.0.0',
            },
          ],
          'repo-with-dot-and-git-suffix': [
            {
              source: 'github.com/hashicorp/example.2.3.git?ref=v1.0.0',
            },
          ],
          'repo-with-non-semver-ref': [
            {
              source:
                'github.com/githubuser/myrepo//terraform/modules/moduleone?ref=tfmodule_one-v0.0.9',
            },
          ],
        },
      });
    });

    it('should return nested terraform block', async () => {
      const res = await parseHCL(lockedVersion, 'file.tf');
      expect(res).toMatchObject({
        terraform: [
          {
            required_providers: [
              {
                aws: {},
                azurerm: {},
                kubernetes: {},
              },
            ],
          },
        ],
      });
    });

    it('should return resource blocks', async () => {
      const res = await parseHCL(resourcesTF, 'file.tf');
      expect(res).toMatchObject({
        resource: {
          docker_container: {
            foo: {},
            invalid: {},
          },
          docker_service: {
            foo: [
              {
                name: 'foo-service',
                task_spec: [
                  {
                    container_spec: {},
                  },
                ],
                endpoint_spec: [
                  {
                    ports: {},
                  },
                ],
              },
            ],
          },
        },
      });
    });
  });

  describe('parseJSON', () => {
    it('should parse json', () => {
      const res = parseJSON(resourcesTFJSON);
      expect(res).toMatchObject({
        resource: {
          aws_instance: {
            example: {},
          },
        },
      });
    });
  });
});
