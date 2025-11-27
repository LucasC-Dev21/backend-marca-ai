import { registerAs } from '@nestjs/config';
import { CookiesConfig, CookieSameSite } from 'src/shared/types/cookies.types';

const ambient = process.env.AMBIENT || 'DEVELOPMENT';

function parseSameSite(value?: string): CookieSameSite {
  const lower = value?.toLowerCase();
  if (lower === 'lax' || lower === 'strict' || lower === 'none') return lower;
  return 'none';
}

export default registerAs<CookiesConfig>('cookies', (): CookiesConfig => {
  if (ambient === 'DEVELOPMENT') {
    return {
      cookie_domain: process.env.COOKIE_DOMAIN_DEV,
      cookie_path: process.env.COOKIE_PATH_DEV,
      cookie_http_only: process.env.COOKIE_HTTP_ONLY_DEV === 'true',
      cookie_secure: process.env.COOKIE_SECURE_DEV === 'true',
      cookie_same_site: parseSameSite(process.env.COOKIE_SAME_SITE_DEV),
    };
  }

  return {
    cookie_domain: process.env.COOKIE_DOMAIN_PROD,
    cookie_path: process.env.COOKIE_PATH_PROD,
    cookie_http_only: process.env.COOKIE_HTTP_ONLY_PROD === 'true',
    cookie_secure: process.env.COOKIE_SECURE_PROD === 'true',
    cookie_same_site: parseSameSite(process.env.COOKIE_SAME_SITE_PROD),
  };
});
