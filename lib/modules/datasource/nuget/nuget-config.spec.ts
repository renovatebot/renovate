import { XmlDocument } from 'xmldoc';
import { GlobalConfig } from '../../../config/global.ts';
import * as hostRules from '../../../util/host-rules.ts';
import {
  expandEnvVariables,
  extractAndRegisterPackageSourceCredentials,
  setNugetConfig,
  unescapeFeedName,
} from './nuget-config.ts';

describe('modules/datasource/nuget/nuget-config', () => {
  beforeEach(() => {
    hostRules.clear();
    GlobalConfig.reset();
    setNugetConfig('');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('unescapeFeedName()', () => {
    it('returns unmodified string when no escape sequences present', () => {
      expect(unescapeFeedName('MyFeed')).toBe('MyFeed');
    });

    it('unescapes hex sequence _x0020_ to space', () => {
      expect(unescapeFeedName('My_x0020_Feed')).toBe('My Feed');
    });

    it('unescapes multiple hex sequences', () => {
      expect(unescapeFeedName('_x002e_My_x0020_Feed_x0021_')).toBe('.My Feed!');
    });

    it('handles uppercase and lowercase hex digits', () => {
      expect(unescapeFeedName('_x002f_and_x002F_')).toBe('/and/');
    });
  });

  describe('expandEnvVariables()', () => {
    it('returns plain string unchanged', () => {
      expect(expandEnvVariables('plaintext', false)).toBe('plaintext');
    });

    it('expands %VAR% when trusted', () => {
      vi.stubEnv('MY_SECRET', 'expanded-token');
      expect(expandEnvVariables('prefix-%MY_SECRET%', false)).toBe(
        'prefix-expanded-token',
      );
    });

    it('expands ${VAR} and $VAR when trusted', () => {
      vi.stubEnv('TOKEN_A', 'aaa');
      vi.stubEnv('TOKEN_B', 'bbb');
      expect(expandEnvVariables('${TOKEN_A}_$TOKEN_B', false)).toBe('aaa_bbb');
    });

    it('returns empty string if env variable is missing', () => {
      expect(expandEnvVariables('%MISSING_VAR%', false)).toBe('');
    });

    it('strips env variables from repo config when exposeAllEnv is false', () => {
      vi.stubEnv('MY_SECRET', 'expanded-token');
      GlobalConfig.set({ exposeAllEnv: false });
      expect(expandEnvVariables('%MY_SECRET%', true)).toBe('');
    });

    it('expands env variables from repo config when exposeAllEnv is true', () => {
      vi.stubEnv('MY_SECRET', 'expanded-token');
      GlobalConfig.set({ exposeAllEnv: true });
      expect(expandEnvVariables('%MY_SECRET%', true)).toBe('expanded-token');
    });
  });

  describe('extractAndRegisterPackageSourceCredentials()', () => {
    it('does nothing when packageSources is missing', () => {
      const doc = new XmlDocument(
        '<configuration><packageSourceCredentials /></configuration>',
      );
      extractAndRegisterPackageSourceCredentials(doc);
      expect(hostRules.findAll({ hostType: 'nuget' })).toBeEmptyArray();
    });

    it('does nothing when packageSourceCredentials is missing', () => {
      const doc = new XmlDocument(
        '<configuration><packageSources><add key="feed" value="https://feed.org" /></packageSources></configuration>',
      );
      extractAndRegisterPackageSourceCredentials(doc);
      expect(hostRules.findAll({ hostType: 'nuget' })).toBeEmptyArray();
    });

    it('extracts Username and ClearTextPassword', () => {
      const doc = new XmlDocument(`
        <configuration>
          <packageSources>
            <add key="MyFeed" value="https://pkgs.example.org/v3/index.json" />
          </packageSources>
          <packageSourceCredentials>
            <MyFeed>
              <add key="Username" value="feeduser" />
              <add key="ClearTextPassword" value="feedpass" />
            </MyFeed>
          </packageSourceCredentials>
        </configuration>
      `);

      extractAndRegisterPackageSourceCredentials(doc);

      const rules = hostRules.findAll({ hostType: 'nuget' });
      expect(rules).toHaveLength(2);
      expect(rules[0]).toMatchObject({
        hostType: 'nuget',
        matchHost: 'https://pkgs.example.org/v3/index.json',
        username: 'feeduser',
        password: 'feedpass',
      });
      expect(rules[1]).toMatchObject({
        hostType: 'nuget',
        matchHost: 'https://pkgs.example.org/v3',
        username: 'feeduser',
        password: 'feedpass',
      });

      const found = hostRules.find({
        hostType: 'nuget',
        url: 'https://pkgs.example.org/v3/registrations2/pkg',
      });
      expect(found).toMatchObject({
        username: 'feeduser',
        password: 'feedpass',
      });
    });

    it('extracts Password with case-insensitive attributes', () => {
      const doc = new XmlDocument(`
        <configuration>
          <packageSources>
            <add Key="myfeed" Value="https://pkgs.example.org/nuget" />
          </packageSources>
          <packageSourceCredentials>
            <myfeed>
              <add Key="Password" Value="my-token" />
            </myfeed>
          </packageSourceCredentials>
        </configuration>
      `);

      extractAndRegisterPackageSourceCredentials(doc);

      const rules = hostRules.findAll({ hostType: 'nuget' });
      expect(rules).toHaveLength(1);
      expect(rules[0]).toMatchObject({
        hostType: 'nuget',
        matchHost: 'https://pkgs.example.org/nuget',
        password: 'my-token',
      });
      expect(rules[0].username).toBeUndefined();
    });

    it('extracts Username without password', () => {
      const doc = new XmlDocument(`
        <configuration>
          <packageSources>
            <add key="useronly" value="https://pkgs.example.org/useronly" />
          </packageSources>
          <packageSourceCredentials>
            <useronly>
              <add key="Username" value="onlyuser" />
            </useronly>
          </packageSourceCredentials>
        </configuration>
      `);

      extractAndRegisterPackageSourceCredentials(doc);

      const rules = hostRules.findAll({ hostType: 'nuget' });
      expect(rules).toHaveLength(1);
      expect(rules[0]).toMatchObject({
        hostType: 'nuget',
        matchHost: 'https://pkgs.example.org/useronly',
        username: 'onlyuser',
      });
      expect(rules[0].password).toBeUndefined();
    });

    it('matches escaped feed names in XML', () => {
      const doc = new XmlDocument(`
        <configuration>
          <packageSources>
            <add key="Special Feed" value="https://special.example.org/v3/index.json" />
          </packageSources>
          <packageSourceCredentials>
            <Special_x0020_Feed>
              <add key="Username" value="user" />
              <add key="ClearTextPassword" value="secret" />
            </Special_x0020_Feed>
          </packageSourceCredentials>
        </configuration>
      `);

      extractAndRegisterPackageSourceCredentials(doc);

      const found = hostRules.find({
        hostType: 'nuget',
        url: 'https://special.example.org/v3/index.json',
      });
      expect(found).toMatchObject({
        username: 'user',
        password: 'secret',
      });
    });

    it('ignores unknown feeds, non-http sources, and empty credentials', () => {
      const doc = new XmlDocument(`
        <configuration>
          <packageSources>
            <add key="localFeed" value="/local/path" />
            <add key="emptyFeed" value="https://empty.example.org" />
          </packageSources>
          <packageSourceCredentials>
            <!-- comment child -->
            <unknownFeed>
              <add key="Username" value="user" />
            </unknownFeed>
            <localFeed>
              <add key="Username" value="user" />
            </localFeed>
            <emptyFeed>
              <!-- no username or password -->
              <add key="other" value="val" />
            </emptyFeed>
          </packageSourceCredentials>
        </configuration>
      `);

      extractAndRegisterPackageSourceCredentials(doc);
      expect(hostRules.findAll({ hostType: 'nuget' })).toBeEmptyArray();
    });
  });

  describe('setNugetConfig()', () => {
    it('resets when called without arguments', () => {
      setNugetConfig(`
        <configuration>
          <packageSources>
            <add key="feed" value="https://feed.org" />
          </packageSources>
          <packageSourceCredentials>
            <feed>
              <add key="ClearTextPassword" value="pwd" />
            </feed>
          </packageSourceCredentials>
        </configuration>
      `);

      expect(hostRules.findAll({ hostType: 'nuget' })).toHaveLength(1);

      setNugetConfig();
      setNugetConfig('');
    });

    it('ignores identical consecutive inputs', () => {
      const config = `
        <configuration>
          <packageSources>
            <add key="feed" value="https://feed.org" />
          </packageSources>
          <packageSourceCredentials>
            <feed>
              <add key="ClearTextPassword" value="pwd" />
            </feed>
          </packageSourceCredentials>
        </configuration>
      `;

      setNugetConfig(config);
      expect(hostRules.findAll({ hostType: 'nuget' })).toHaveLength(1);

      setNugetConfig(config);
      expect(hostRules.findAll({ hostType: 'nuget' })).toHaveLength(1);
    });

    it('handles malformed XML gracefully', () => {
      setNugetConfig('<not valid xml');
      expect(hostRules.findAll({ hostType: 'nuget' })).toBeEmptyArray();
    });
  });
});
