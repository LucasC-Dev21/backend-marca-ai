import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => {
  return {
    secret: process.env.JWT_SECRET,
    secret_deslogar: process.env.JWT_SECRET_DESLOGAR_SESSAO,
    audience: process.env.JWT_TOKEN_AUDIENCE,
    issuer: process.env.JWT_TOKEN_ISSUER,
    jwtTtl: Number(process.env.JWT_TTL) || 900,
    jwtTtlDeslogar: Number(process.env.JWT_TTL_DESLOGAR) || 300,
    jwtTtlExtensao: Number(process.env.JWT_TTL_EXTENSAO) || 3600,
  };
});
