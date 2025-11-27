import { IsString, IsNotEmpty, IsEmail, Length } from 'class-validator';

export class PreCadastroMasterDto {
  @IsString()
  @IsNotEmpty()
  nomeEmpresa: string;

  @IsString()
  @IsNotEmpty()
  telefone: string;

  @IsString()
  @IsNotEmpty()
  @Length(14, 14, { message: 'CNPJ deve ter 14 caracteres (apenas números).' })
  cnpj: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 255, { message: 'A senha deve ter pelo menos 6 caracteres.' })
  senha: string;
}
