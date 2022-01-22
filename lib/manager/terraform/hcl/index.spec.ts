import { loadFixture } from '../../../../test/util';
import { parseHCL, parseJSON } from './index';

const modulesTF = loadFixture('modules.tf');
const resourcesTF = loadFixture('resources.tf');
const resourcesTFJSON = loadFixture('resources.tf.json');
const lockedVersion = loadFixture('lockedVersion.tf');

describe('manager/terraform/hcl/index', () => {
  describe('parseHCL()', () => {
    it('should return flat modules', async () => {
      const res = await parseHCL(modulesTF);
      expect(Object.keys(res.module)).toBeArrayOfSize(6);
      expect(res).toMatchSnapshot();
    });

    it('should return nested terraform block', async () => {
      const res = await parseHCL(lockedVersion);
      expect(res).toMatchSnapshot({
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
      const res = await parseHCL(resourcesTF);
      expect(res).toMatchSnapshot({
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
    it('should parse json', async () => {
      const res = await parseJSON(resourcesTFJSON);
      expect(res).toMatchSnapshot({
        resource: {
          aws_instance: {
            example: {},
          },
        },
      });
    });
  });
});
