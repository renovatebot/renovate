export interface ComposerManagerData {
  composerJsonType?: string;
}

export interface UserPass {
  username: string;
  password: string;
}

export interface AuthJson {
  bearer?: Record<string, string>;
  'github-oauth'?: Record<string, string>;
  'gitlab-token'?: Record<string, string>;
  'gitlab-domains'?: string[];
  'http-basic'?: Record<string, UserPass>;
}
