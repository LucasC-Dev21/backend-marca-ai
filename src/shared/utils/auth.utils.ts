import * as bcrypt from 'bcryptjs';

/**
 * Gera a string de conexão com o banco do novo Tenant, usando a que está na .env, substituindo o nome
 * padrão pelo nome do banco criado para o novo tenant
 *
 * @param dbName - Nome do banco de dados do novo Tenant
 * @returns String de conexão com o banco de dados
 */
export function gerarStringConection(
  dbName: string,
  tenant_database_url: string,
): string {
  return tenant_database_url.replace('example_tenant', dbName);
}

/**
 * Camufla um endereço IP (IPv4 ou IPv6) para exibição segura em logs ou relatórios.
 *
 * - Para IPv4: mantém apenas o primeiro e último octeto (ex: 192.xxx.xxx.10)
 * - Para IPv6: mantém apenas os dois primeiros blocos e o último, substituindo o restante por 'xxxx'
 *
 * @param ip - Endereço IP do cliente (IPv4 ou IPv6)
 * @returns IP camuflado, adequado para exibição sem expor completamente o endereço
 */
export function camuflarIp(ip: string): string {
  if (ip.includes('.')) {
    // IPv4
    const partes = ip.split('.');
    if (partes.length !== 4) return 'IP inválido';
    return `${partes[0]}.xxx.xxx.${partes[3]}`;
  } else if (ip.includes(':')) {
    // IPv6
    const partes = ip.split(':');
    if (partes.length < 3) return 'IP inválido';
    const inicio = partes.slice(0, 2).join(':');
    const fim = partes[partes.length - 1];
    const camuflado = Array(partes.length - 3)
      .fill('xxxx')
      .join(':');
    return `${inicio}:${camuflado}:${fim}`;
  } else {
    return 'IP inválido';
  }
}

/**
 * Retorna uma versão "invertida" do CNPJ fornecido,
 * invertendo a ordem dos caracteres da string.
 *
 * @param cnpjNumber - CNPJ como string
 * @returns CNPJ invertido
 */
export function cnpjNomeBd(cnpjNumber: string): string {
  return cnpjNumber.split('').reverse().join('');
}

/**
 * Monta o nome completo do banco de dados a partir do CNPJ, nome do tenant e baseinfo.
 *
 * @param cnpj - CNPJ associado
 * @param baseinfo - informações adicionais da base
 * @param tokenTenantNameDatabase - nome do tenant do token (opcional, pega do config se não informado)
 * @returns string formatada em lowercase
 */
export function formatarNomeBanco(
  cnpj: string | undefined,
  baseinfo: string,
  tokenTenantNameDatabase: string | undefined,
): string {
  const safeCnpj = cnpj ?? '';
  const tenantName = tokenTenantNameDatabase ?? '';
  return `${safeCnpj}_${tenantName}_${baseinfo}`.toLowerCase();
}

/**
 * Gera o hash de uma senha utilizando bcrypt.
 *
 * @param senha - senha em texto plano
 * @returns string com o hash gerado
 */
export async function hash(senha: string): Promise<string> {
  const salt = await bcrypt.genSalt();
  return bcrypt.hash(senha, salt);
}

/**
 * Compara uma senha em texto plano com o hash armazenado.
 *
 * @param senha - senha em texto plano
 * @param senhaHash - hash da senha armazenado no banco
 * @returns boolean indicando se a senha é válida
 */
export async function compare(
  senha: string,
  senhaHash: string,
): Promise<boolean> {
  return bcrypt.compare(senha, senhaHash); // true === logado
}

/**
 * Gera um código numérico aleatório de 6 dígitos para uso em confirmações de e-mail.
 *
 * O código gerado varia de 100000 a 999999, garantindo sempre 6 dígitos.
 * Pode ser usado, por exemplo, como código de verificação (OTP) temporário
 * enviado por e-mail para autenticação ou confirmação de cadastro.
 *
 * @returns {number} Código de acesso de 6 dígitos
 */
export function gerarCodigoAcessoEmail(): number {
  const min = 100000;
  const max = 999999;
  return Math.floor(Math.random() * (max - min + 1) + min);
}

interface AccessCodeResult {
  codigoAcesso: number;
  expiraEm: Date;
}

/**
 * Envia um código de acesso por e-mail para um destinatário e retorna o código gerado junto com a data de expiração.
 *
 * Este código pode ser usado para verificação temporária, autenticação de dois fatores (2FA)
 * ou confirmação de cadastro. Recomenda-se salvar o código e a data de expiração em um
 * banco de dados ou cache (como Redis) para validação posterior.
 *
 * @param emailDestinatario - E-mail do usuário que receberá o código
 * @param mailService - Instância do serviço de envio de e-mails (ex: MailService)
 * @param codigoAcesso - Código numérico de acesso gerado previamente
 * @param recipientName - Nome do destinatário (opcional, usado na saudação do e-mail)
 *
 * @returns {Promise<AccessCodeResult>} Objeto contendo:
 *   - codigoAcesso: o código enviado
 *   - expiresAt: data e hora de expiração do código (10 minutos após envio)
 *
 * @throws Lança erro caso o envio do e-mail falhe
 */
export async function enviarCodigoAcesso(
  emailDestinatario: string,
  mailService,
  codigoAcesso: number,
  recipientName?: string,
): Promise<AccessCodeResult> {
  const expiraEm = new Date(Date.now() + 10 * 60 * 1000);

  const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style="margin:0;background:#f4f7fb;font-family:Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td align="center" style="padding:32px 12px;">
              <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:12px;box-shadow:0 6px 30px rgba(16,24,40,0.08);overflow:hidden;">
                <tr>
                  <td style="padding:28px 36px 8px 36px;text-align:center;">
                    <h1 style="margin:0;font-size:20px;color:#0f172a;">Código de Acesso</h1>
                    <p style="margin:8px 0 0 0;color:#475569;">${recipientName ? `Olá, ${recipientName}` : 'Olá'} — use o código abaixo para continuar.</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:20px 36px;text-align:center;">
                    <div style="display:inline-block;padding:18px 26px;border-radius:14px;background:linear-gradient(90deg,#6366f1 0%,#06b6d4 100%);">
                      <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Helvetica Neue', monospace; letter-spacing:6px; font-size:28px; color:#fff; font-weight:700;">${codigoAcesso}</span>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:8px 48px 24px 48px;text-align:center;color:#64748b;font-size:14px;">
                    <p style="margin:0 0 6px 0;">Este código expira em <strong>10 minutos</strong>.</p>
                    <p style="margin:0;">Se você não solicitou este código, ignore este e‑mail.</p>
                  </td>
                </tr>

                <tr>
                  <td style="background:#f8fafc;padding:18px 36px;text-align:center;color:#94a3b8;font-size:13px;">
                    <small>Equipe • Dashbot</small>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  const plain = `Seu código de acesso é: ${codigoAcesso}\nExpira em 10 minutos.\nSe você não solicitou, ignore.`;

  try {
    await mailService.enviarEmail({
      to: emailDestinatario,
      from: 'Dashbot <tecnobil.dev@gmail.com>',
      subject: 'Seu código de acesso — Dashbot',
      text: plain,
      html,
    });

    console.log(`Código de acesso enviado para ${emailDestinatario}`);
  } catch (err) {
    console.error('Erro ao enviar código de acesso', err);
    throw err; // propaga o erro para o controller tratar
  }

  return { codigoAcesso, expiraEm };
}
