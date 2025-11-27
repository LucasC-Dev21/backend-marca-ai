export type SessaoAtiva = {
  id: string;
  criadoEm: Date;
  expiraEm: Date;
  ip: string | null;
  userAgent: string | null;
};

export type LoginResponse = {
  cookies?: object;
  sessoesAtivas?: SessaoAtiva[];
};

export type VerificarUsuarioResponse = {
  auth: boolean;
  user: {
    id: string;
    nomeEmpresa: string;
    email?: string;
  };
  cookies?: object;
  sessoesAtivas?: SessaoAtiva[];
};
