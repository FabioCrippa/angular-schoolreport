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

export interface Escola {
  id?: string;
  nome: string;
  emailDirecao: string;
  emailCoordenacao: string;
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
  documentoResponsavel?: string; // Para saídas: CPF ou RG
  registradoPor: string; // email da secretaria
  registradoPorNome: string; // nome da secretaria
  criadoEm?: Date;
  expandido?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  
  private firestore = inject(Firestore);
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
  
  // Gera email em HTML
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
          subject: `Bem-vindo ao SchoolReport - ${escolaNome}`,
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

Você foi cadastrado no sistema SchoolReport da escola ${escolaNome}.

Para criar sua senha e acessar o sistema, clique no link abaixo:
${link}

Utilize o email: ${email}

Após acessar o link, você poderá criar sua senha e fazer login no sistema.

Atenciosamente,
Equipe SchoolReport
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
      <h1>📋 Bem-vindo ao SchoolReport!</h1>
    </div>
    <div class="content">
      <p style="font-size: 18px; color: #1f2937;">Olá <strong>${nome}</strong>!</p>
      
      <p>Você foi cadastrado no sistema SchoolReport da escola <strong>${escolaNome}</strong>.</p>
      
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
      <p><strong>SchoolReport</strong> - Sistema de Gestão Escolar</p>
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
}