import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy,
  Timestamp 
} from '@angular/fire/firestore';

export interface Ocorrencia {
  id?: string;
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

  async buscarOcorrencias(): Promise<Ocorrencia[]> {
    try {
      const querySnapshot = await getDocs(this.ocorrenciasCollection);
      
      const ocorrencias: Ocorrencia[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        ocorrencias.push({
          id: doc.id,
          ...data,
          criadoEm: data['criadoEm']?.toDate()
        } as Ocorrencia);
      });
      
      console.log('Buscou do Firestore:', ocorrencias);
      return ocorrencias;
      
    } catch (error) {
      console.error('Erro ao buscar ocorrências:', error);
      throw error;
    }
  }
}