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
  
  async adicionarOcorrencia(ocorrencia: Omit<Ocorrencia, 'id' | 'criadoEm'>): Promise<string> {
    try {
      const docRef = await addDoc(this.ocorrenciasCollection, {
        ...ocorrencia,
        criadoEm: Timestamp.now()
      });
      
      console.log('Ocorrência salva com ID:', docRef.id);
      return docRef.id;
      
    } catch (error) {
      console.error('Erro ao salvar ocorrência:', error);
      throw error;
    }
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