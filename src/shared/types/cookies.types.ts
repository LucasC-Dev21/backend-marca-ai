export type CookieSameSite = boolean | 'lax' | 'strict' | 'none';

export interface CookiesConfig {
  cookie_domain: string | undefined;
  cookie_path: string | undefined;
  cookie_http_only: boolean;
  cookie_secure: boolean;
  cookie_same_site: CookieSameSite | undefined;
}
