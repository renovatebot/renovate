import { fs } from '../../../../test/util';
import { detectGlobalConfig } from '.';

vi.mock('../../../util/fs');

describe('modules/manager/maven/detect', () => {
  describe('.detectGlobalConfig()', () => {
    it('detects .npmrc in home directory', async () => {
      fs.readSystemFile.mockResolvedValueOnce(
        '<settingsxmlns="http://maven.apache.org/SETTINGS/1.0.0"xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0https://maven.apache.org/xsd/settings-1.0.0.xsd"><mirrors><mirror><id>internal-baeldung-repository</id><name>BaeldungInternalRepo</name><url>https://baeldung.com/repo/maven2/</url><mirrorOf>*</mirrorOf></mirror></mirrors></settings>',
      );
      const res = await detectGlobalConfig();
      expect(res).toMatchInlineSnapshot(`
        {
          "mavenSettings": "<settingsxmlns="http://maven.apache.org/SETTINGS/1.0.0"xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0https://maven.apache.org/xsd/settings-1.0.0.xsd"><mirrors><mirror><id>internal-baeldung-repository</id><name>BaeldungInternalRepo</name><url>https://baeldung.com/repo/maven2/</url><mirrorOf>*</mirrorOf></mirror></mirrors></settings>",
          "mavenSettingsMerge": true,
        }
      `);
      expect(res.mavenSettings).toBeDefined();
      expect(res.mavenSettingsMerge).toBe(true);
    });

    it('handles no .m2/settings.xml', async () => {
      fs.readSystemFile.mockRejectedValueOnce('error');
      const res = await detectGlobalConfig();
      expect(res).toEqual({});
    });
  });
});
