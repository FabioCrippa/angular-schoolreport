import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query, 
  where,
  orderBy,
  Timestamp 
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

export interface Escola {
  id?: string;
  nome: string;
  emailDirecao: string;
  emailCoordenacao: string;
  emailSecretaria?: string;
  status: 'ativo' | 'inativo';
  plano: 'mensal' | 'anual' | 'trial';
  criadoEm?: Date;
}

export interface Usuario {
  id?: string;
  email: string;
  nome: string;
  escolaId: string;
  role: 'professor' | 'coordenacao' | 'direcao' | 'secretaria';
  ativo: boolean;
  criadoEm?: Date;
}

export interface Ocorrencia {
  id?: string;
  escolaId: string;
  nomeAluno: string;
  data: string;
  tipoEnsino: string;
  turma: string;
  disciplina: string;
  tipoOcorrencia: string;
  descricao: string;
  professorNome: string;
  professorEmail: string;
  criadoEm?: Date;
  expandido?: boolean;
}

export interface ControleEntradaSaida {
  id?: string;
  escolaId: string;
  tipo: 'atraso' | 'saida';
  alunoNome: string;
  turma: string;
  tipoEnsino: string;
  data: string;
  horario: string;
  motivo?: string;
  aulaPermitida?: string; // Para atrasos: "2ª aula", "3ª aula", etc
  responsavel?: string; // Para saídas: nome do responsável
  telefoneResponsavel?: string; // Para saídas: telefone do responsável
  registradoPor: string; // email da secretaria
  registradoPorNome: string; // nome da secretaria
  criadoEm?: Date;
  expandido?: boolean;
}

export interface Aluno {
  id?: string;
  escolaId: string;
  nome: string;
  turma: string;
  serie: string;
  ativo?: boolean;
  criadoEm?: Date;
  atualizadoEm?: Date;
}

export interface Falta {
  id?: string;
  escolaId: string;
  turmaId?: string;
  turma: string;
  data: string; // YYYY-MM-DD
  alunos: {
    [alunoId: string]: {
      alunoNome: string;
      presente: boolean;
    };
  };
  registradoEm?: Date;
  registradoPor: string; // uid da secretaria
  registradoPorNome: string; // nome da secretaria
}

export interface Conversa {
  id?: string;
  escolaId: string;
  alunoId: string;
  alunoNome: string;
  responsavel: string;
  resultadoContato: 'conversa' | 'nao_conseguiu' | 'recado' | 'ligar_novamente';
  notas: string;
  registradoEm: Date;
  registradoPor: string;
  registradoPorNome: string;
}

export interface DiarioEntrada {
  id?: string;
  escolaId: string;
  professorId: string;
  professorNome: string;
  turma: string;
  disciplina: string;
  data: string; // YYYY-MM-DD
  numeroAula?: number;
  conteudo: string;
  observacao?: string;
  recursos: string[];
  registradoEm?: Date;
}

export interface StatusBuscaAtiva {
  id?: string;
  escolaId: string;
  alunoId: string;
  alunoNome: string;
  ultimoContato: Date;
  resultado: 'conversa' | 'nao_conseguiu' | 'recado' | 'ligar_novamente';
  motivo?: 'consecutivas' | 'alto_indice' | 'ambos';
  registradoPor: string;
  registradoPorNome: string;
}

export interface AulaFaltaProfessor {
  turma: string;
  numeroAula: string;
}

export interface FaltaProfessor {
  id?: string;
  escolaId: string;
  data: string; // YYYY-MM-DD
  professorNome: string;
  periodo: 'manha' | 'tarde' | 'noite';
  tipoAfastamento?: string; // FM, J, I, F, LS, LG, LP, N, RE, SP
  aulas: AulaFaltaProfessor[];
  professorEventual: string;
  registradoEm?: Date;
  registradoPor: string;
  registradoPorNome: string;
}

export interface DadosFuncionaisProfessor {
  professorId: string;
  escolaId: string;
  // Dados pessoais (Seção 1)
  nomeCompleto: string;
  dataNascimento?: string;  // YYYY-MM-DD
  sexo?: string;            // M / F
  matricula: string;
  rg: string;
  cpf: string;
  // Dados de cargo (Seção 1 + 2)
  cargo: string;
  categoria?: string;
  orgaoClassificacao?: string;
  municipio?: string;
  lotacao: string;
  pisPasep: string;
  // Informações funcionais (Seção 2)
  horarioTrabalho?: string;
  horarioEstudante?: string;
  localFuncao?: string;
  inicioNoCargo?: string;        // YYYY-MM-DD
  inicioServicoPublico?: string; // YYYY-MM-DD
  acumulaCargo?: string;         // S / N
  // Observações (Seção 5)
  observacoes?: string;
  atualizadoEm?: Date;
  atualizadoPor?: string;
}

export interface Professor {
  id?: string;
  escolaId: string;
  nome: string;
  disciplinas: string[];
  ativo: boolean;
  criadoEm?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private ocorrenciasCollection = collection(this.firestore, 'ocorrencias');
  
  async adicionarOcorrencia(ocorrencia: Omit<Ocorrencia, 'id' | 'criadoEm'>, escolaData?: { nome: string, emailCoordenacao: string, emailDirecao: string }): Promise<string> {
    try {
      // Prepara dados da ocorrência (SEM campos de email)
      const ocorrenciaData: any = {
        ...ocorrencia,
        criadoEm: Timestamp.now()
      };
      
      // Salva a ocorrência
      const docRef = await addDoc(this.ocorrenciasCollection, ocorrenciaData);
      console.log('Ocorrência salva com ID:', docRef.id);
      
      // Se tiver dados da escola, cria outro documento para enviar email
      if (escolaData) {
        const emailsDestino = [];
        
        // Adiciona emails de coordenação e direção
        if (escolaData.emailCoordenacao) {
          emailsDestino.push(escolaData.emailCoordenacao);
        }
        if (escolaData.emailDirecao) {
          emailsDestino.push(escolaData.emailDirecao);
        }
        
        if (emailsDestino.length > 0) {
          const emailData = {
            to: emailsDestino,
            message: {
              subject: `Nova Ocorrência - ${ocorrencia.nomeAluno} - ${escolaData.nome}`,
              text: this.gerarEmailTexto(ocorrencia, escolaData),
              html: this.gerarEmailHTML(ocorrencia, escolaData)
            }
          };
          
          // Cria documento separado na coleção 'ocorrencias' só para email
          await addDoc(this.ocorrenciasCollection, emailData);
          console.log('Email de ocorrência enviado para:', emailsDestino.join(', '));
        }
      }
      
      return docRef.id;
      
    } catch (error) {
      console.error('Erro ao salvar ocorrência:', error);
      throw error;
    }
  }

  async deletarOcorrencia(ocorrenciaId: string): Promise<void> {
    try {
      console.log('Tentando deletar ocorrência:', ocorrenciaId);
      const ocorrenciaRef = doc(this.ocorrenciasCollection, ocorrenciaId);
      await deleteDoc(ocorrenciaRef);
      console.log('✅ Ocorrência deletada com sucesso:', ocorrenciaId);
    } catch (error: any) {
      console.error('❌ Erro ao deletar ocorrência:', error);
      console.error('Detalhes do erro:', error.message, error.code);
      throw error;
    }
  }
  
  // Converte string de data para Date local (evita problema de timezone)
  private converterDataLocal(dataString: string): Date {
    const partes = dataString.split('-');
    return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
  }
  
  // Gera email em texto simples
  private gerarEmailTexto(occ: any, escola: any): string {
    return `
NOVA OCORRÊNCIA REGISTRADA

Escola: ${escola.nome}
Data: ${this.converterDataLocal(occ.data).toLocaleDateString('pt-BR')}

ALUNO
Nome: ${occ.nomeAluno}
Turma: ${occ.turma}

OCORRÊNCIA
Tipo: ${occ.tipoOcorrencia}
Disciplina: ${occ.disciplina}

DESCRIÇÃO
${occ.descricao}

REGISTRADO POR
${occ.professorNome}
(${occ.professorEmail})

Acesse o sistema para mais detalhes.
    `;
  }
  
  // Gera email em HTML para ocorrências
  private gerarEmailHTML(occ: any, escola: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .card { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #3B82F6; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; color: white; background: #3B82F6; }
    .label { font-weight: bold; color: #6b7280; }
    .value { color: #1f2937; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏫 Nova Ocorrência Registrada</h1>
      <p style="margin: 5px 0 0 0;">${escola.nome}</p>
    </div>
    <div class="content">
      <div class="card">
        <p><span class="label">Data:</span> <span class="value">${this.converterDataLocal(occ.data).toLocaleDateString('pt-BR')}</span></p>
        <p><span class="label">Hora:</span> <span class="value">${new Date().toLocaleTimeString('pt-BR')}</span></p>
      </div>
      
      <div class="card">
        <h3 style="margin-top: 0; color: #1f2937;">👨‍🎓 Aluno</h3>
        <p><span class="label">Nome:</span> <span class="value">${occ.nomeAluno}</span></p>
        <p><span class="label">Turma:</span> <span class="value">${occ.turma}</span></p>
        <p><span class="label">Tipo de Ensino:</span> <span class="value">${occ.tipoEnsino}</span></p>
      </div>
      
      <div class="card">
        <h3 style="margin-top: 0; color: #1f2937;">📝 Ocorrência</h3>
        <p><span class="label">Tipo:</span> <span class="value">${occ.tipoOcorrencia}</span></p>
        <p><span class="label">Disciplina:</span> <span class="value">${occ.disciplina}</span></p>
      </div>
      
      <div class="card">
        <h3 style="margin-top: 0; color: #1f2937;">Descrição</h3>
        <p style="white-space: pre-wrap;">${occ.descricao}</p>
      </div>
      
      <div class="card">
        <h3 style="margin-top: 0; color: #1f2937;">👨‍🏫 Registrado por</h3>
        <p><span class="value">${occ.professorNome}</span></p>
        <p style="font-size: 14px; color: #6b7280;">${occ.professorEmail}</p>
      </div>
    </div>
    <div class="footer">
      <p>Sistema de Ocorrências Escolares</p>
      <p>Este é um email automático, não responda.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  // ===== ENVIO DE EMAILS PARA ATRASO E SAÍDA ANTECIPADA =====

  async enviarEmailAtraso(atraso: ControleEntradaSaida, escolaData: { nome: string, emailCoordenacao?: string, emailDirecao?: string }): Promise<void> {
    try {
      const emailsDestino: string[] = [];
      
      // Adiciona emails de coordenação e direção
      if (escolaData.emailCoordenacao) {
        emailsDestino.push(escolaData.emailCoordenacao);
      }
      if (escolaData.emailDirecao) {
        emailsDestino.push(escolaData.emailDirecao);
      }
      
      if (emailsDestino.length === 0) {
        console.log('⚠️ Nenhum email de coordenação/direção cadastrado para envio');
        return;
      }
      
      const emailData = {
        to: emailsDestino,
        message: {
          subject: `⏰ Registro de Atraso - ${atraso.alunoNome} - ${escolaData.nome}`,
          text: this.gerarEmailTextoAtraso(atraso, escolaData),
          html: this.gerarEmailHTMLAtraso(atraso, escolaData)
        }
      };
      
      await addDoc(this.ocorrenciasCollection, emailData);
      console.log('✅ Email de atraso enviado para:', emailsDestino.join(', '));
      
    } catch (error) {
      console.error('❌ Erro ao enviar email de atraso:', error);
      // Não lança erro para não bloquear o registro
    }
  }

  async enviarEmailSaida(saida: ControleEntradaSaida, escolaData: { nome: string, emailCoordenacao?: string, emailDirecao?: string }): Promise<void> {
    try {
      const emailsDestino: string[] = [];
      
      // Adiciona emails de coordenação e direção
      if (escolaData.emailCoordenacao) {
        emailsDestino.push(escolaData.emailCoordenacao);
      }
      if (escolaData.emailDirecao) {
        emailsDestino.push(escolaData.emailDirecao);
      }
      
      if (emailsDestino.length === 0) {
        console.log('⚠️ Nenhum email de coordenação/direção cadastrado para envio');
        return;
      }
      
      const emailData = {
        to: emailsDestino,
        message: {
          subject: `🚪 Saída Antecipada - ${saida.alunoNome} - ${escolaData.nome}`,
          text: this.gerarEmailTextoSaida(saida, escolaData),
          html: this.gerarEmailHTMLSaida(saida, escolaData)
        }
      };
      
      await addDoc(this.ocorrenciasCollection, emailData);
      console.log('✅ Email de saída enviado para:', emailsDestino.join(', '));
      
    } catch (error) {
      console.error('❌ Erro ao enviar email de saída:', error);
      // Não lança erro para não bloquear o registro
    }
  }

  private gerarEmailTextoAtraso(atraso: ControleEntradaSaida, escola: any): string {
    return `
REGISTRO DE ATRASO

Escola: ${escola.nome}
Data: ${new Date(atraso.data).toLocaleDateString('pt-BR')}

ALUNO
Nome: ${atraso.alunoNome}
Turma: ${atraso.turma}
Tipo de Ensino: ${atraso.tipoEnsino}

INFORMAÇÕES DO ATRASO
Horário de chegada: ${atraso.horario}
Aula permitida: ${atraso.aulaPermitida || 'Não especificada'}
${atraso.motivo ? `Motivo: ${atraso.motivo}` : ''}

REGISTRADO POR
${atraso.registradoPorNome}
(${atraso.registradoPor})

Acesse o sistema para mais detalhes.
    `;
  }

  private gerarEmailHTMLAtraso(atraso: ControleEntradaSaida, escola: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .card { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #f59e0b; }
    .label { font-weight: bold; color: #6b7280; }
    .value { color: #1f2937; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Registro de Atraso</h1>
      <p style="margin: 5px 0 0 0;">${escola.nome}</p>
    </div>
    <div class="content">
      <div class="card">
        <p><span class="label">Data:</span> <span class="value">${new Date(atraso.data).toLocaleDateString('pt-BR')}</span></p>
        <p><span class="label">Horário de chegada:</span> <span class="value">${atraso.horario}</span></p>
      </div>
      
      <div class="card">
        <h3 style="margin-top: 0; color: #1f2937;">👨‍🎓 Aluno</h3>
        <p><span class="label">Nome:</span> <span class="value">${atraso.alunoNome}</span></p>
        <p><span class="label">Turma:</span> <span class="value">${atraso.turma}</span></p>
        <p><span class="label">Tipo de Ensino:</span> <span class="value">${atraso.tipoEnsino}</span></p>
      </div>
      
      <div class="card">
        <h3 style="margin-top: 0; color: #1f2937;">📋 Informações</h3>
        <p><span class="label">Aula permitida:</span> <span class="value">${atraso.aulaPermitida || 'Não especificada'}</span></p>
        ${atraso.motivo ? `<p><span class="label">Motivo:</span> <span class="value">${atraso.motivo}</span></p>` : ''}
      </div>
      
      <div class="card">
        <h3 style="margin-top: 0; color: #1f2937;">👤 Registrado por</h3>
        <p><span class="value">${atraso.registradoPorNome}</span></p>
        <p style="font-size: 14px; color: #6b7280;">${atraso.registradoPor}</p>
      </div>
    </div>
    <div class="footer">
      <p>Sistema de Controle Escolar</p>
      <p>Este é um email automático, não responda.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private gerarEmailTextoSaida(saida: ControleEntradaSaida, escola: any): string {
    return `
SAÍDA ANTECIPADA

Escola: ${escola.nome}
Data: ${new Date(saida.data).toLocaleDateString('pt-BR')}

ALUNO
Nome: ${saida.alunoNome}
Turma: ${saida.turma}
Tipo de Ensino: ${saida.tipoEnsino}

INFORMAÇÕES DA SAÍDA
Horário de saída: ${saida.horario}
Motivo: ${saida.motivo}

RESPONSÁVEL
Nome: ${saida.responsavel || 'Não informado'}
${saida.telefoneResponsavel ? `Telefone: ${saida.telefoneResponsavel}` : ''}

REGISTRADO POR
${saida.registradoPorNome}
(${saida.registradoPor})

Acesse o sistema para mais detalhes.
    `;
  }

  private gerarEmailHTMLSaida(saida: ControleEntradaSaida, escola: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .card { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #ef4444; }
    .label { font-weight: bold; color: #6b7280; }
    .value { color: #1f2937; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚪 Saída Antecipada</h1>
      <p style="margin: 5px 0 0 0;">${escola.nome}</p>
    </div>
    <div class="content">
      <div class="card">
        <p><span class="label">Data:</span> <span class="value">${new Date(saida.data).toLocaleDateString('pt-BR')}</span></p>
        <p><span class="label">Horário de saída:</span> <span class="value">${saida.horario}</span></p>
      </div>
      
      <div class="card">
        <h3 style="margin-top: 0; color: #1f2937;">👨‍🎓 Aluno</h3>
        <p><span class="label">Nome:</span> <span class="value">${saida.alunoNome}</span></p>
        <p><span class="label">Turma:</span> <span class="value">${saida.turma}</span></p>
        <p><span class="label">Tipo de Ensino:</span> <span class="value">${saida.tipoEnsino}</span></p>
      </div>
      
      <div class="card">
        <h3 style="margin-top: 0; color: #1f2937;">📋 Informações</h3>
        <p><span class="label">Motivo:</span> <span class="value">${saida.motivo}</span></p>
      </div>
      
      <div class="card">
        <h3 style="margin-top: 0; color: #1f2937;">👥 Responsável</h3>
        <p><span class="label">Nome:</span> <span class="value">${saida.responsavel || 'Não informado'}</span></p>
        ${saida.telefoneResponsavel ? `<p><span class="label">Telefone:</span> <span class="value">${saida.telefoneResponsavel}</span></p>` : ''}
      </div>
      
      <div class="card">
        <h3 style="margin-top: 0; color: #1f2937;">👤 Registrado por</h3>
        <p><span class="value">${saida.registradoPorNome}</span></p>
        <p style="font-size: 14px; color: #6b7280;">${saida.registradoPor}</p>
      </div>
    </div>
    <div class="footer">
      <p>Sistema de Controle Escolar</p>
      <p>Este é um email automático, não responda.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  async buscarOcorrencias(escolaId: string): Promise<Ocorrencia[]> {
    try {
      // Filtrar apenas ocorrências da escola específica
      const q = query(
        this.ocorrenciasCollection, 
        where('escolaId', '==', escolaId)
      );
      
      const querySnapshot = await getDocs(q);
      
      const ocorrencias: Ocorrencia[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        ocorrencias.push({
          id: doc.id,
          ...data,
          criadoEm: data['criadoEm']?.toDate()
        } as Ocorrencia);
      });
      
      console.log(`Buscou ${ocorrencias.length} ocorrências da escola ${escolaId}`);
      return ocorrencias;
      
    } catch (error) {
      console.error('Erro ao buscar ocorrências:', error);
      throw error;
    }
  }

  async buscarUsuario(userId: string): Promise<Usuario | null> {
    try {
      console.log('🔍 Buscando documento usuarios/' + userId);
      const usuarioDoc = await getDoc(doc(this.firestore, 'usuarios', userId));
      
      if (usuarioDoc.exists()) {
        const data = usuarioDoc.data();
        console.log('✅ Documento encontrado:', data);
        return {
          email: data['email'],
          nome: data['nome'],
          escolaId: data['escolaId'],
          role: data['role'],
          ativo: data['ativo'],
          criadoEm: data['criadoEm']?.toDate()
        } as Usuario;
      }
      
      // Fallback: document may have been created with addDoc (random ID instead of UID)
      const currentEmail = this.auth.currentUser?.email;
      if (currentEmail) {
        console.log('🔄 UID não encontrado, tentando busca por email:', currentEmail);
        const porEmail = await this.buscarUsuarioPorEmail(currentEmail);
        if (porEmail) {
          console.log('✅ Usuário encontrado por email');
          // Migrate document to use UID as ID so future lookups work
          this.adicionarUsuarioComId(userId, porEmail).catch(() => {});
          return porEmail;
        }
      }

      console.log('❌ Documento não existe');
      return null;
      
    } catch (error) {
      console.error('❌ Erro ao buscar usuário:', error);
      throw error;
    }
  }

  // Envia email de primeiro acesso para novo usuário
  async enviarEmailPrimeiroAcesso(email: string, nome: string, escolaNome: string): Promise<void> {
    try {
      const primeiroAcessoLink = `${window.location.origin}/primeiro-acesso`;
      
      const mailData = {
        to: [email],
        message: {
          subject: `Bem-vindo ao escu - ${escolaNome}`,
          text: this.gerarEmailPrimeiroAcessoTexto(nome, email, escolaNome, primeiroAcessoLink),
          html: this.gerarEmailPrimeiroAcessoHTML(nome, email, escolaNome, primeiroAcessoLink)
        }
      };
      
      console.log('📧 Tentando enviar email para:', email);
      console.log('📦 Dados do email:', mailData);
      
      // Adiciona documento na coleção 'ocorrencias' (monitorada pela Firebase Extension)
      const docRef = await addDoc(this.ocorrenciasCollection, mailData);
      
      console.log('✅ Email de primeiro acesso criado com ID:', docRef.id);
      console.log('✅ Email será enviado automaticamente pela Firebase Extension');
    } catch (error: any) {
      console.error('❌ Erro ao enviar email de primeiro acesso:', error);
      console.error('❌ Código do erro:', error.code);
      console.error('❌ Mensagem:', error.message);
      throw error;
    }
  }

  private gerarEmailPrimeiroAcessoTexto(nome: string, email: string, escolaNome: string, link: string): string {
    return `
Olá ${nome}!

Você foi cadastrado no sistema escu da escola ${escolaNome}.

Para criar sua senha e acessar o sistema, clique no link abaixo:
${link}

Utilize o email: ${email}

Após acessar o link, você poderá criar sua senha e fazer login no sistema.

Atenciosamente,
Equipe escu
    `;
  }

  private gerarEmailPrimeiroAcessoHTML(nome: string, email: string, escolaNome: string, link: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .card { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #3B82F6; }
    .btn { display: inline-block; padding: 14px 28px; background: #3B82F6; color: white !important; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
    .btn:hover { background: #2563EB; }
    .info { background: #EFF6FF; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .label { font-weight: bold; color: #6b7280; }
    .value { color: #1f2937; font-family: monospace; background: white; padding: 2px 6px; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Bem-vindo ao escu!</h1>
    </div>
    <div class="content">
      <p style="font-size: 18px; color: #1f2937;">Olá <strong>${nome}</strong>!</p>
      
      <p>Você foi cadastrado no sistema escu da escola <strong>${escolaNome}</strong>.</p>
      
      <div class="card">
        <h3 style="margin-top: 0; color: #1f2937;">🔐 Criar sua senha</h3>
        <p>Para acessar o sistema, você precisa criar sua senha de acesso.</p>
        <p style="text-align: center;">
          <a href="${link}" class="btn">Criar minha senha</a>
        </p>
      </div>
      
      <div class="info">
        <p style="margin: 5px 0;"><span class="label">📧 Seu email de acesso:</span></p>
        <p style="margin: 5px 0; font-size: 16px;"><span class="value">${email}</span></p>
      </div>
      
      <div class="card">
        <h4 style="margin-top: 0; color: #1f2937;">Instruções:</h4>
        <ol style="padding-left: 20px;">
          <li>Clique no botão "Criar minha senha" acima</li>
          <li>Digite o email: <strong>${email}</strong></li>
          <li>Crie uma senha segura (mínimo 6 caracteres)</li>
          <li>Faça login no sistema</li>
        </ol>
      </div>
      
      <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
        Se você não conseguir clicar no botão, copie e cole este link no seu navegador:<br>
        <span style="color: #3B82F6; word-break: break-all;">${link}</span>
      </p>
    </div>
    <div class="footer">
      <p><strong>escu</strong> - Sistema de Gestão Escolar</p>
      <p>Este é um email automático, não responda.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  async buscarUsuarioPorEmail(email: string): Promise<(Usuario & { docId: string }) | null> {
    try {
      const usuariosCollection = collection(this.firestore, 'usuarios');
      const q = query(usuariosCollection, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        return {
          id: doc.id,
          docId: doc.id,
          email: data['email'],
          nome: data['nome'],
          escolaId: data['escolaId'],
          role: data['role'],
          ativo: data['ativo'],
          criadoEm: data['criadoEm']?.toDate()
        } as Usuario & { docId: string };
      }
      
      return null;
      
    } catch (error) {
      console.error('Erro ao buscar usuário por email:', error);
      throw error;
    }
  }

  // ========== MÉTODOS ADMIN - ESCOLAS ==========

  async buscarEscola(escolaId: string): Promise<Escola | null> {
    try {
      const escolaDoc = await getDoc(doc(this.firestore, 'escolas', escolaId));
      
      if (escolaDoc.exists()) {
        const data = escolaDoc.data();
        return {
          id: escolaDoc.id,
          nome: data['nome'],
          emailDirecao: data['emailDirecao'],
          emailCoordenacao: data['emailCoordenacao'],
          status: data['status'],
          plano: data['plano'],
          criadoEm: data['criadoEm']?.toDate()
        } as Escola;
      }
      
      return null;
      
    } catch (error) {
      console.error('Erro ao buscar escola:', error);
      throw error;
    }
  }

  async buscarTodasEscolas(): Promise<Escola[]> {
    try {
      const escolasCollection = collection(this.firestore, 'escolas');
      const querySnapshot = await getDocs(escolasCollection);
      
      const escolas: Escola[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        escolas.push({
          id: doc.id,
          nome: data['nome'],
          emailDirecao: data['emailDirecao'],
          emailCoordenacao: data['emailCoordenacao'],
          status: data['status'],
          plano: data['plano'],
          criadoEm: data['criadoEm']?.toDate()
        } as Escola);
      });
      
      return escolas;
      
    } catch (error) {
      console.error('Erro ao buscar escolas:', error);
      throw error;
    }
  }

  async adicionarEscola(escola: Omit<Escola, 'id' | 'criadoEm'>): Promise<string> {
    try {
      const escolasCollection = collection(this.firestore, 'escolas');
      const docRef = await addDoc(escolasCollection, {
        ...escola,
        criadoEm: Timestamp.now()
      });
      
      console.log('Escola criada com ID:', docRef.id);
      return docRef.id;
      
    } catch (error) {
      console.error('Erro ao adicionar escola:', error);
      throw error;
    }
  }

  async atualizarEscola(escolaId: string, dados: Partial<Omit<Escola, 'id' | 'criadoEm'>>): Promise<void> {
    try {
      const escolaDoc = doc(this.firestore, 'escolas', escolaId);
      await updateDoc(escolaDoc, dados);
      console.log('Escola atualizada:', escolaId);
    } catch (error) {
      console.error('Erro ao atualizar escola:', error);
      throw error;
    }
  }

  async deletarEscola(escolaId: string): Promise<void> {
    try {
      const escolaDoc = doc(this.firestore, 'escolas', escolaId);
      await deleteDoc(escolaDoc);
      console.log('Escola deletada:', escolaId);
    } catch (error) {
      console.error('Erro ao deletar escola:', error);
      throw error;
    }
  }

  // ========== MÉTODOS ADMIN - USUÁRIOS ==========

  async listarUsuariosPorEscola(escolaId: string): Promise<Usuario[]> {
    try {
      console.log('📡 Buscando usuários com escolaId:', escolaId);
      const usuariosCollection = collection(this.firestore, 'usuarios');
      const q = query(usuariosCollection, where('escolaId', '==', escolaId));
      const querySnapshot = await getDocs(q);
      
      console.log('📊 Documentos encontrados:', querySnapshot.size);
      
      const usuarios: Usuario[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('📄 Documento:', doc.id, data);
        usuarios.push({
          id: doc.id,
          email: data['email'],
          nome: data['nome'],
          escolaId: data['escolaId'],
          role: data['role'],
          ativo: data['ativo'],
          criadoEm: data['criadoEm']?.toDate()
        } as Usuario);
      });
      
      console.log('✅ Total de usuários retornados:', usuarios.length);
      return usuarios;
      
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      throw error;
    }
  }

  async listarProfessoresDaEscola(escolaId: string): Promise<{ id: string; nome: string }[]> {
    try {
      const col = collection(this.firestore, 'usuarios');
      const q = query(col, where('escolaId', '==', escolaId), where('role', '==', 'professor'));
      const snap = await getDocs(q);
      const result = snap.docs
        .map(d => ({ id: d.id, nome: d.data()['nome'] as string }))
        .filter(u => u.nome)
        .sort((a, b) => a.nome.localeCompare(b.nome));
      return result;
    } catch (error) {
      console.error('Erro ao listar professores da escola:', error);
      return [];
    }
  }

  async adicionarUsuarioFirestore(usuario: Omit<Usuario, 'id' | 'criadoEm'>): Promise<string> {
    try {
      const usuariosCollection = collection(this.firestore, 'usuarios');
      const docRef = await addDoc(usuariosCollection, {
        ...usuario,
        criadoEm: Timestamp.now()
      });
      
      console.log('Usuário criado no Firestore com ID:', docRef.id);
      return docRef.id;
      
    } catch (error) {
      console.error('Erro ao adicionar usuário:', error);
      throw error;
    }
  }

  async adicionarUsuarioComId(uid: string, usuario: Omit<Usuario, 'id' | 'criadoEm'>): Promise<void> {
    try {
      const usuarioDoc = doc(this.firestore, 'usuarios', uid);
      await setDoc(usuarioDoc, {
        ...usuario,
        id: uid,
        criadoEm: Timestamp.now()
      });
      
      console.log('Usuário criado no Firestore com UID:', uid);
      
    } catch (error) {
      console.error('Erro ao adicionar usuário com ID:', error);
      throw error;
    }
  }

  async atualizarUsuario(userId: string, dados: Partial<Omit<Usuario, 'id' | 'criadoEm'>>): Promise<void> {
    try {
      const usuarioDoc = doc(this.firestore, 'usuarios', userId);
      await updateDoc(usuarioDoc, dados);
      console.log('Usuário atualizado:', userId);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  async deletarUsuario(userId: string): Promise<void> {
    try {
      const usuarioDoc = doc(this.firestore, 'usuarios', userId);
      await deleteDoc(usuarioDoc);
      console.log('Usuário deletado:', userId);
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      throw error;
    }
  }

  // ===== CONTROLE DE ENTRADA/SAÍDA =====
  
  async adicionarControle(controle: Omit<ControleEntradaSaida, 'id' | 'criadoEm'>): Promise<string> {
    try {
      console.log('📝 Tentando adicionar controle:', controle);
      const controleCollection = collection(this.firestore, 'controleEntradaSaida');
      const docRef = await addDoc(controleCollection, {
        ...controle,
        criadoEm: Timestamp.now()
      });
      console.log('✅ Controle de entrada/saída adicionado:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Erro ao adicionar controle:', error);
      throw error;
    }
  }
  
  async buscarControles(escolaId: string, data?: string): Promise<ControleEntradaSaida[]> {
    try {
      const controleCollection = collection(this.firestore, 'controleEntradaSaida');
      let q;
      
      if (data) {
        // Buscar apenas da data específica
        q = query(
          controleCollection,
          where('escolaId', '==', escolaId),
          where('data', '==', data)
        );
      } else {
        // Buscar todos da escola
        q = query(
          controleCollection,
          where('escolaId', '==', escolaId)
        );
      }
      
      const querySnapshot = await getDocs(q);
      const controles: ControleEntradaSaida[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        controles.push({
          id: doc.id,
          ...data,
          criadoEm: data['criadoEm']?.toDate()
        } as ControleEntradaSaida);
      });
      
      console.log(`Buscou ${controles.length} registros de controle`);
      return controles;
      
    } catch (error) {
      console.error('Erro ao buscar controles:', error);
      throw error;
    }
  }
  
  async buscarControlesPorTipo(escolaId: string, tipo: 'atraso' | 'saida', data?: string): Promise<ControleEntradaSaida[]> {
    try {
      const controleCollection = collection(this.firestore, 'controleEntradaSaida');
      let q;
      
      if (data) {
        q = query(
          controleCollection,
          where('escolaId', '==', escolaId),
          where('tipo', '==', tipo),
          where('data', '==', data)
        );
      } else {
        q = query(
          controleCollection,
          where('escolaId', '==', escolaId),
          where('tipo', '==', tipo)
        );
      }
      
      const querySnapshot = await getDocs(q);
      const controles: ControleEntradaSaida[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        controles.push({
          id: doc.id,
          ...data,
          criadoEm: data['criadoEm']?.toDate()
        } as ControleEntradaSaida);
      });
      
      return controles;
      
    } catch (error) {
      console.error('Erro ao buscar controles por tipo:', error);
      throw error;
    }
  }

  async deletarControle(controleId: string): Promise<void> {
    try {
      const controleRef = doc(this.firestore, 'controleEntradaSaida', controleId);
      await deleteDoc(controleRef);
      console.log('Controle deletado:', controleId);
    } catch (error) {
      console.error('Erro ao deletar controle:', error);
      throw error;
    }
  }

  // ===== AGENDA DE EQUIPAMENTOS =====

  async obterAgendaEquipamentos(escolaId: string): Promise<any[]> {
    try {
      const agendaCollection = collection(this.firestore, 'agendaEquipamentos');
      const q = query(agendaCollection, where('escolaId', '==', escolaId), orderBy('dataReserva', 'asc'));
      const querySnapshot = await getDocs(q);
      
      const reservas: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        reservas.push({
          id: doc.id,
          ...data,
          criadoEm: data['criadoEm']?.toDate()
        });
      });
      
      return reservas;
    } catch (error) {
      console.error('Erro ao obter agenda de equipamentos:', error);
      throw error;
    }
  }

  async criarAgendaEquipamento(reserva: any): Promise<string> {
    try {
      const agendaCollection = collection(this.firestore, 'agendaEquipamentos');
      const docRef = await addDoc(agendaCollection, {
        ...reserva,
        criadoEm: Timestamp.now()
      });
      
      console.log('Agendamento criado com ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      throw error;
    }
  }

  async atualizarAgendaEquipamento(reservaId: string, dados: any): Promise<void> {
    try {
      const reservaDoc = doc(this.firestore, 'agendaEquipamentos', reservaId);
      await updateDoc(reservaDoc, dados);
      console.log('Agendamento atualizado:', reservaId);
    } catch (error) {
      console.error('Erro ao atualizar agendamento:', error);
      throw error;
    }
  }

  async cancelarAgendaEquipamento(reservaId: string): Promise<void> {
    try {
      const reservaDoc = doc(this.firestore, 'agendaEquipamentos', reservaId);
      await updateDoc(reservaDoc, { status: 'cancelada' });
      console.log('Agendamento cancelado:', reservaId);
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      throw error;
    }
  }

  async obterTurmasProfessor(professorId: string): Promise<any[]> {
    try {
      const turmasCollection = collection(this.firestore, 'turmas');
      const q = query(turmasCollection, where('professores', 'array-contains', professorId));
      const querySnapshot = await getDocs(q);
      
      const turmas: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        turmas.push({
          id: doc.id,
          nome: data['nome'],
          ...data
        });
      });
      
      return turmas;
    } catch (error) {
      console.error('Erro ao obter turmas do professor:', error);
      throw error;
    }
  }

  // ================== MÉTODOS PARA GERENCIAR ALUNOS ==================

  async importarAlunos(escolaId: string, alunos: Array<{ nome: string; turma: string; serie: string }>): Promise<number> {
    try {
      const alunosCollection = collection(this.firestore, 'alunos');
      let contador = 0;

      for (const aluno of alunos) {
        const alunoData: any = {
          escolaId,
          nome: aluno.nome.trim(),
          turma: aluno.turma.trim(),
          serie: aluno.serie.trim(),
          ativo: true,
          criadoEm: Timestamp.now(),
          atualizadoEm: Timestamp.now()
        };

        await addDoc(alunosCollection, alunoData);
        contador++;
      }

      console.log(`✅ ${contador} alunos importados com sucesso`);
      return contador;
    } catch (error) {
      console.error('Erro ao importar alunos:', error);
      throw error;
    }
  }

  async obterAlunos(escolaId: string): Promise<Aluno[]> {
    try {
      const alunosCollection = collection(this.firestore, 'alunos');
      const q = query(
        alunosCollection, 
        where('escolaId', '==', escolaId)
      );
      
      const querySnapshot = await getDocs(q);
      const alunos: Aluno[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filtrar apenas alunos ativos em memória
        if (data['ativo'] !== false) {
          alunos.push({
            id: doc.id,
            escolaId: data['escolaId'],
            nome: data['nome'],
            turma: data['turma'],
            serie: data['serie'],
            ativo: data['ativo'],
            criadoEm: data['criadoEm']?.toDate(),
            atualizadoEm: data['atualizadoEm']?.toDate()
          });
        }
      });
      
      // Ordenar em memória por turma e depois por nome
      alunos.sort((a, b) => {
        if (a.turma !== b.turma) {
          return a.turma.localeCompare(b.turma);
        }
        return a.nome.localeCompare(b.nome);
      });
      
      return alunos;
    } catch (error) {
      console.error('Erro ao obter alunos:', error);
      throw error;
    }
  }

  async atualizarAluno(alunoId: string, dados: Partial<Aluno>): Promise<void> {
    try {
      const alunoDoc = doc(this.firestore, 'alunos', alunoId);
      const dataAtualizacao = {
        ...dados,
        atualizadoEm: Timestamp.now()
      };
      await updateDoc(alunoDoc, dataAtualizacao);
      console.log('✅ Aluno atualizado:', alunoId);
    } catch (error) {
      console.error('Erro ao atualizar aluno:', error);
      throw error;
    }
  }

  async deletarAluno(alunoId: string): Promise<void> {
    try {
      const alunoDoc = doc(this.firestore, 'alunos', alunoId);
      await updateDoc(alunoDoc, { ativo: false, atualizadoEm: Timestamp.now() });
      console.log('✅ Aluno deletado (desativado):', alunoId);
    } catch (error) {
      console.error('Erro ao deletar aluno:', error);
      throw error;
    }
  }

  async limparAlunos(escolaId: string): Promise<void> {
    try {
      const alunosCollection = collection(this.firestore, 'alunos');
      const q = query(alunosCollection, where('escolaId', '==', escolaId));
      const querySnapshot = await getDocs(q);
      
      for (const doc_item of querySnapshot.docs) {
        await updateDoc(doc(this.firestore, 'alunos', doc_item.id), { 
          ativo: false,
          atualizadoEm: Timestamp.now() 
        });
      }
      
      console.log('✅ Todos os alunos foram desativados');
    } catch (error) {
      console.error('Erro ao limpar alunos:', error);
      throw error;
    }
  }

  async deletarFaltasDoAluno(escolaId: string, alunoId: string): Promise<number> {
    try {
      const faltasCollection = collection(this.firestore, 'faltas');
      const q = query(
        faltasCollection, 
        where('escolaId', '==', escolaId),
        where('alunoId', '==', alunoId)
      );
      const querySnapshot = await getDocs(q);
      
      let contador = 0;
      for (const doc_item of querySnapshot.docs) {
        await deleteDoc(doc(this.firestore, 'faltas', doc_item.id));
        contador++;
      }
      
      console.log(`✅ ${contador} faltas deletadas do aluno ${alunoId}`);
      return contador;
    } catch (error) {
      console.error('Erro ao deletar faltas do aluno:', error);
      throw error;
    }
  }

  async deletarFaltasDaTurma(escolaId: string, turma: string): Promise<number> {
    try {
      const faltasCollection = collection(this.firestore, 'faltas');
      const q = query(
        faltasCollection, 
        where('escolaId', '==', escolaId),
        where('turma', '==', turma)
      );
      const querySnapshot = await getDocs(q);
      
      let contador = 0;
      for (const doc_item of querySnapshot.docs) {
        await deleteDoc(doc(this.firestore, 'faltas', doc_item.id));
        contador++;
      }
      
      console.log(`✅ ${contador} faltas deletadas da turma ${turma}`);
      return contador;
    } catch (error) {
      console.error('Erro ao deletar faltas da turma:', error);
      throw error;
    }
  }

  // ================== MÉTODOS PARA GERENCIAR FALTAS ==================

  async registrarFaltas(escolaId: string, falta: Omit<Falta, 'id' | 'registradoEm'>): Promise<string> {
    try {
      const faltasCollection = collection(this.firestore, 'faltas');
      const docRef = await addDoc(faltasCollection, {
        ...falta,
        registradoEm: Timestamp.now()
      });
      console.log('✅ Faltas registradas com sucesso:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Erro ao registrar faltas:', error);
      throw error;
    }
  }

  async obterFaltasPorData(escolaId: string, data: string): Promise<Falta[]> {
    try {
      const faltasCollection = collection(this.firestore, 'faltas');
      const q = query(
        faltasCollection,
        where('escolaId', '==', escolaId),
        where('data', '==', data)
      );
      
      const querySnapshot = await getDocs(q);
      const faltas: Falta[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        faltas.push({
          id: doc.id,
          escolaId: data['escolaId'],
          turmaId: data['turmaId'],
          turma: data['turma'],
          data: data['data'],
          alunos: data['alunos'],
          registradoEm: data['registradoEm']?.toDate(),
          registradoPor: data['registradoPor'],
          registradoPorNome: data['registradoPorNome']
        });
      });
      
      return faltas;
    } catch (error) {
      console.error('Erro ao obter faltas por data:', error);
      throw error;
    }
  }

  async obterFaltasPorTurmaEData(escolaId: string, turma: string, data: string): Promise<Falta | null> {
    try {
      const faltasCollection = collection(this.firestore, 'faltas');
      const q = query(
        faltasCollection,
        where('escolaId', '==', escolaId),
        where('turma', '==', turma),
        where('data', '==', data)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      const data_obj = doc.data();
      
      return {
        id: doc.id,
        escolaId: data_obj['escolaId'],
        turmaId: data_obj['turmaId'],
        turma: data_obj['turma'],
        data: data_obj['data'],
        alunos: data_obj['alunos'],
        registradoEm: data_obj['registradoEm']?.toDate(),
        registradoPor: data_obj['registradoPor'],
        registradoPorNome: data_obj['registradoPorNome']
      };
    } catch (error) {
      console.error('Erro ao obter faltas por turma e data:', error);
      throw error;
    }
  }

  async atualizarFaltas(faltaId: string, alunos: Falta['alunos']): Promise<void> {
    try {
      const faltaDoc = doc(this.firestore, 'faltas', faltaId);
      await updateDoc(faltaDoc, { alunos });
      console.log('✅ Faltas atualizadas:', faltaId);
    } catch (error) {
      console.error('Erro ao atualizar faltas:', error);
      throw error;
    }
  }

  async deletarFaltas(faltaId: string): Promise<void> {
    try {
      const faltaDoc = doc(this.firestore, 'faltas', faltaId);
      await deleteDoc(faltaDoc);
      console.log('✅ Registro de faltas deletado:', faltaId);
    } catch (error) {
      console.error('Erro ao deletar faltas:', error);
      throw error;
    }
  }

  async obterFaltasPorEscola(escolaId: string): Promise<Falta[]> {
    try {
      const faltasCollection = collection(this.firestore, 'faltas');
      const q = query(
        faltasCollection,
        where('escolaId', '==', escolaId)
      );
      
      const querySnapshot = await getDocs(q);
      const faltas: Falta[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        faltas.push({
          id: doc.id,
          escolaId: data['escolaId'],
          turmaId: data['turmaId'],
          turma: data['turma'],
          data: data['data'],
          alunos: data['alunos'],
          registradoEm: data['registradoEm']?.toDate(),
          registradoPor: data['registradoPor'],
          registradoPorNome: data['registradoPorNome']
        });
      });
      
      return faltas;
    } catch (error) {
      console.error('Erro ao obter faltas por escola:', error);
      throw error;
    }
  }

  // ================== MÉTODOS PARA GERENCIAR CONVERSAS ==================

  async salvarConversa(escolaId: string, conversa: Omit<Conversa, 'id' | 'escolaId'>): Promise<string> {
    try {
      const conversasCollection = collection(this.firestore, 'conversas');
      const docRef = await addDoc(conversasCollection, {
        ...conversa,
        escolaId,
        registradoEm: Timestamp.now()
      });
      console.log('✅ Conversa registrada com sucesso:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Erro ao salvar conversa:', error);
      throw error;
    }
  }

  async obterConversas(escolaId: string, alunoId: string): Promise<Conversa[]> {
    try {
      const conversasCollection = collection(this.firestore, 'conversas');
      const q = query(
        conversasCollection,
        where('escolaId', '==', escolaId),
        where('alunoId', '==', alunoId)
      );

      const querySnapshot = await getDocs(q);
      const conversas: Conversa[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        conversas.push({
          id: doc.id,
          escolaId: data['escolaId'],
          alunoId: data['alunoId'],
          alunoNome: data['alunoNome'],
          responsavel: data['responsavel'],
          resultadoContato: data['resultadoContato'] || 'conversa',
          notas: data['notas'],
          registradoEm: data['registradoEm']?.toDate(),
          registradoPor: data['registradoPor'],
          registradoPorNome: data['registradoPorNome']
        });
      });

      return conversas;
    } catch (error) {
      console.error('Erro ao obter conversas:', error);
      throw error;
    }
  }

  async registrarStatusBuscaAtiva(escolaId: string, status: Omit<StatusBuscaAtiva, 'id'>): Promise<string> {
    try {
      const buscaAtivaCollection = collection(this.firestore, 'buscaAtivaStatus');
      // Procurar se já existe registro para este aluno
      const q = query(
        buscaAtivaCollection,
        where('escolaId', '==', escolaId),
        where('alunoId', '==', status.alunoId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.size > 0) {
        // Atualizar registro existente
        const docRef = querySnapshot.docs[0].ref;
        await updateDoc(docRef, {
          ...status,
          ultimoContato: Timestamp.now()
        });
        console.log('✅ Status de busca ativa atualizado:', docRef.id);
        return docRef.id;
      } else {
        // Criar novo registro
        const docRef = await addDoc(buscaAtivaCollection, {
          ...status,
          ultimoContato: Timestamp.now()
        });
        console.log('✅ Status de busca ativa registrado:', docRef.id);
        return docRef.id;
      }
    } catch (error) {
      console.error('Erro ao registrar status de busca ativa:', error);
      throw error;
    }
  }

  async obterStatusBuscaAtiva(escolaId: string, alunoId: string): Promise<StatusBuscaAtiva | null> {
    try {
      const buscaAtivaCollection = collection(this.firestore, 'buscaAtivaStatus');
      const q = query(
        buscaAtivaCollection,
        where('escolaId', '==', escolaId),
        where('alunoId', '==', alunoId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.size > 0) {
        const data = querySnapshot.docs[0].data();
        return {
          id: querySnapshot.docs[0].id,
          escolaId: data['escolaId'],
          alunoId: data['alunoId'],
          alunoNome: data['alunoNome'],
          ultimoContato: data['ultimoContato']?.toDate(),
          resultado: data['resultado'],
          registradoPor: data['registradoPor'],
          registradoPorNome: data['registradoPorNome']
        };
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao obter status de busca ativa:', error);
      return null;
    }
  }

  async obterTodosBuscaAtiva(escolaId: string): Promise<StatusBuscaAtiva[]> {
    try {
      const buscaAtivaCollection = collection(this.firestore, 'buscaAtivaStatus');
      const q = query(
        buscaAtivaCollection,
        where('escolaId', '==', escolaId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          escolaId: data['escolaId'],
          alunoId: data['alunoId'],
          alunoNome: data['alunoNome'],
          ultimoContato: data['ultimoContato']?.toDate(),
          resultado: data['resultado'],
          registradoPor: data['registradoPor'],
          registradoPorNome: data['registradoPorNome']
        };
      });
    } catch (error) {
      console.error('Erro ao obter todos status busca ativa:', error);
      return [];
    }
  }

  async salvarFaltaProfessor(falta: Omit<FaltaProfessor, 'id'>): Promise<string> {
    try {
      const col = collection(this.firestore, 'faltasProfessores');
      const docRef = await addDoc(col, {
        ...falta,
        registradoEm: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Erro ao salvar falta de professor:', error);
      throw error;
    }
  }

  async obterFaltasProfessores(escolaId: string): Promise<FaltaProfessor[]> {
    try {
      const col = collection(this.firestore, 'faltasProfessores');
      const q = query(col, where('escolaId', '==', escolaId));
      const snap = await getDocs(q);
      const result = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<FaltaProfessor, 'id'>),
        registradoEm: d.data()['registradoEm']?.toDate()
      }));
      // Ordenar por data decrescente em memória (evita índice composto no Firestore)
      result.sort((a, b) => b.data.localeCompare(a.data));
      return result;
    } catch (error) {
      console.error('Erro ao obter faltas de professores:', error);
      return [];
    }
  }

  async buscarDadosFuncionaisProfessor(professorId: string): Promise<DadosFuncionaisProfessor | null> {
    try {
      const docRef = doc(this.firestore, 'dadosFuncionaisProfessores', professorId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return {
          professorId: snap.id,
          ...(snap.data() as Omit<DadosFuncionaisProfessor, 'professorId'>),
          atualizadoEm: snap.data()['atualizadoEm']?.toDate()
        };
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar dados funcionais do professor:', error);
      return null;
    }
  }

  async salvarDadosFuncionaisProfessor(dados: Omit<DadosFuncionaisProfessor, 'atualizadoEm'>): Promise<void> {
    try {
      const docRef = doc(this.firestore, 'dadosFuncionaisProfessores', dados.professorId);
      await setDoc(docRef, { ...dados, atualizadoEm: Timestamp.now() }, { merge: true });
    } catch (error) {
      console.error('Erro ao salvar dados funcionais do professor:', error);
      throw error;
    }
  }

  async listarDadosFuncionaisProfessores(escolaId: string): Promise<DadosFuncionaisProfessor[]> {
    try {
      const col = collection(this.firestore, 'dadosFuncionaisProfessores');
      const q = query(col, where('escolaId', '==', escolaId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        professorId: d.id,
        ...(d.data() as Omit<DadosFuncionaisProfessor, 'professorId'>),
        atualizadoEm: d.data()['atualizadoEm']?.toDate()
      }));
    } catch (error) {
      console.error('Erro ao listar dados funcionais:', error);
      return [];
    }
  }

  async obterProfessores(escolaId: string): Promise<Professor[]> {
    try {
      const col = collection(this.firestore, 'professores');
      const q = query(col, where('escolaId', '==', escolaId), where('ativo', '==', true));
      const snap = await getDocs(q);
      const result = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<Professor, 'id'>),
        criadoEm: d.data()['criadoEm']?.toDate()
      }));
      result.sort((a, b) => a.nome.localeCompare(b.nome));
      return result;
    } catch (error) {
      console.error('Erro ao obter professores:', error);
      return [];
    }
  }

  async salvarProfessor(professor: Omit<Professor, 'id'>): Promise<string> {
    try {
      const col = collection(this.firestore, 'professores');
      const docRef = await addDoc(col, { ...professor, criadoEm: Timestamp.now() });
      return docRef.id;
    } catch (error) {
      console.error('Erro ao salvar professor:', error);
      throw error;
    }
  }

  async atualizarProfessor(id: string, dados: Partial<Professor>): Promise<void> {
    try {
      const docRef = doc(this.firestore, 'professores', id);
      await updateDoc(docRef, dados as any);
    } catch (error) {
      console.error('Erro ao atualizar professor:', error);
      throw error;
    }
  }

  async deletarProfessor(id: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, 'professores', id);
      await updateDoc(docRef, { ativo: false });
    } catch (error) {
      console.error('Erro ao deletar professor:', error);
      throw error;
    }
  }

  // ─── Diário de Classe ───────────────────────────────────────────────

  async salvarDiarioEntrada(entrada: Omit<DiarioEntrada, 'id'>): Promise<string> {
    try {
      const col = collection(this.firestore, 'diario');
      const docRef = await addDoc(col, { ...entrada, registradoEm: Timestamp.now() });
      return docRef.id;
    } catch (error) {
      console.error('Erro ao salvar entrada do diário:', error);
      throw error;
    }
  }

  async obterDiarioEntradas(escolaId: string, professorId: string): Promise<DiarioEntrada[]> {
    try {
      const col = collection(this.firestore, 'diario');
      const q = query(col,
        where('escolaId', '==', escolaId),
        where('professorId', '==', professorId)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<DiarioEntrada, 'id'>),
        registradoEm: d.data()['registradoEm']?.toDate()
      }));
    } catch (error) {
      console.error('Erro ao obter diário:', error);
      return [];
    }
  }

  async atualizarDiarioEntrada(id: string, dados: Partial<DiarioEntrada>): Promise<void> {
    try {
      const docRef = doc(this.firestore, 'diario', id);
      // Firestore updateDoc não aceita undefined — remover campos undefined
      const limpo = Object.fromEntries(
        Object.entries(dados).filter(([, v]) => v !== undefined)
      );
      await updateDoc(docRef, limpo);
    } catch (error) {
      console.error('Erro ao atualizar diário:', error);
      throw error;
    }
  }

  async excluirDiarioEntrada(id: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, 'diario', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Erro ao excluir entrada do diário:', error);
      throw error;
    }
  }
}


