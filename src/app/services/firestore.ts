import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  getDocs,
  getDoc,
  doc,
  query, 
  where,
  orderBy,
  Timestamp 
} from '@angular/fire/firestore';

export interface Usuario {
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
      const usuarioDoc = await getDoc(doc(this.firestore, 'usuarios', userId));
      
      if (usuarioDoc.exists()) {
        const data = usuarioDoc.data();
        return {
          email: data['email'],
          nome: data['nome'],
          escolaId: data['escolaId'],
          role: data['role'],
          ativo: data['ativo'],
          criadoEm: data['criadoEm']?.toDate()
        } as Usuario;
      }
      
      return null;
      
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      throw error;
    }
  }
}