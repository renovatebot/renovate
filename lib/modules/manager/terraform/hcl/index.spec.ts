import { parseHCL } from './index';
import { Fixtures } from '~test/fixtures';

const modulesTF = Fixtures.get('modules.tf');
const resourcesTF = Fixtures.get('resources.tf');
const lockedVersion = Fixtures.get('lockedVersion.tf');

describe('modules/manager/terraform/hcl/index', () => {
  describe('null for invalid name', () => {
    it('should return null', async () => {
      const res = await parseHCL(modulesTF, 'file');
      expect(res).toBeNil();
    });
  });

  describe('parseHCL() for .tf', () => {
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

  describe('parseHCL() for .tf.json', () => {
    it('should return flat modules', async () => {
      const modulesTFJSON = JSON.stringify({
        module: {
          foo: {
            source: 'github.com/hashicorp/example?ref=v1.0.0',
          },
          bar: {
            source: 'github.com/hashicorp/example?ref=next',
          },
          'repo-with-non-semver-ref': {
            source:
              'github.com/githubuser/myrepo//terraform/modules/moduleone?ref=tfmodule_one-v0.0.9',
          },
          'repo-with-dot': {
            source: 'github.com/hashicorp/example.2.3?ref=v1.0.0',
          },
          'repo-with-dot-and-git-suffix': {
            source: 'github.com/hashicorp/example.2.3.git?ref=v1.0.0',
          },
          consul: {
            source: 'hashicorp/consul/aws',
            version: '0.1.0',
          },
        },
      });
      const res = await parseHCL(modulesTFJSON, 'file.tf.json');
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
      const lockedVersionJSON = JSON.stringify({
        terraform: {
          required_providers: {
            aws: {
              source: 'aws',
              version: '~> 3.0',
            },
            azurerm: {
              version: '~> 2.50.0',
            },
            kubernetes: {
              source: 'terraform.example.com/example/kubernetes',
              version: '>= 1.0',
            },
          },
        },
      });
      const res = await parseHCL(lockedVersionJSON, 'file.tf.json');
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
      const resourcesTFJSON = JSON.stringify({
        resource: {
          docker_container: {
            foo: {
              name: 'foo',
              image: 'nginx:1.7.8',
            },
            invalid: {
              name: 'foo',
            },
          },
          docker_service: {
            foo: {
              name: 'foo-service',
              task_spec: [
                {
                  container_spec: [
                    {
                      image: 'repo.mycompany.com:8080/foo-service:v1',
                    },
                  ],
                },
              ],
              endpoint_spec: [
                {
                  ports: [
                    {
                      target_port: '8080',
                    },
                  ],
                },
              ],
            },
          },
        },
      });
      const res = await parseHCL(resourcesTFJSON, 'file.tf.json');
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
});
