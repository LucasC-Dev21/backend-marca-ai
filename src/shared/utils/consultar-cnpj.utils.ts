import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import axios from 'axios';

interface CnpjResponse {
  uf: string;
  cep: string;
  bairro: string;
  numero: string;
  municipio: string;
  logradouro: string;
  complemento: string;
  status: string;
}

export const consultarCnpj = async (cnpj: string) => {
  try {
    const { data } = await axios.get<CnpjResponse>(
      `https://www.receitaws.com.br/v1/cnpj/${cnpj}`,
    );

    return data;
  } catch (error) {
    const statusErros = [400, 404];

    if (
      error.response &&
      statusErros.includes(error.response.status) &&
      error.response.data
    ) {
      const data = error.response.data;
      throw new BadRequestException(data.message);
    }

    throw new InternalServerErrorException(
      'Erro ao consultar o CNPJ na API pública do governo',
    );
  }
};
