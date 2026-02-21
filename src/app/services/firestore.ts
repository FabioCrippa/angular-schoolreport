import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where,
  orderBy,
  Timestamp 
} from '@angular/fire/firestore';

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
}