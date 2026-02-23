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
  role: 'professor' | 'coordenacao' | 'direcao';
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
  gravidade: string;
  descricao: string;
  professorNome: string;
  professorEmail: string;
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
      // Prepara dados da ocorrência
      const ocorrenciaData: any = {
        ...ocorrencia,
        criadoEm: Timestamp.now()
      };
      
      // Se tiver dados da escola, adiciona campos de email para a extensão Firebase
      if (escolaData) {
        const emailsDestino = [];
        
        // Adiciona emails de coordenação e direção
        if (escolaData.emailCoordenacao) emailsDestino.push(escolaData.emailCoordenacao);
        if (escolaData.emailDirecao) emailsDestino.push(escolaData.emailDirecao);
        
        // Campos para Firebase Extension "Trigger Email"
        ocorrenciaData.to = emailsDestino;
        ocorrenciaData.message = {
          subject: `Nova Ocorrência - ${ocorrencia.nomeAluno} - ${escolaData.nome}`,
          text: this.gerarEmailTexto(ocorrencia, escolaData),
          html: this.gerarEmailHTML(ocorrencia, escolaData)
        };
      }
      
      const docRef = await addDoc(this.ocorrenciasCollection, ocorrenciaData);
      
      console.log('Ocorrência salva com ID:', docRef.id);
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
Gravidade: ${occ.gravidade}
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
    const gravidadeCor = {
      'Leve': '#10b981',
      'Moderada': '#f59e0b',
      'Grave': '#ef4444',
      'Gravíssima': '#991b1b'
    }[occ.gravidade as string] || '#6b7280';
    
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
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; color: white; background: ${gravidadeCor}; }
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
        <p><span class="label">Gravidade:</span> <span class="badge">${occ.gravidade}</span></p>
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
}