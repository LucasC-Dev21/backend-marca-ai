import { IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'Informe um login válido' })
  login: string;

  @IsNotEmpty({ message: 'Informe uma senha válida' })
  senha: string;
}
