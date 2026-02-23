import { Injectable } from '@angular/core';
import { Ocorrencia, ControleEntradaSaida } from './firestore';

export interface EstatisticasGerais {
  totalOcorrencias: number;
  ocorrenciasPorGravidade: { [key: string]: number };
  ocorrenciasPorMes: { mes: string; quantidade: number }[];
  ocorrenciasPorTurma: { turma: string; quantidade: number }[];
  topAlunos: { nome: string; quantidade: number }[];
  crescimentoMes: number; // Percentual vs mês anterior
}

export interface EstatisticasSecretaria {
  totalAtrasos: number;
  totalSaidas: number;
  atrasosPorMes: { mes: string; quantidade: number }[];
  saidasPorMes: { mes: string; quantidade: number }[];
  atrasosPorTurma: { turma: string; quantidade: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class RelatoriosService {

  constructor() { }

  // ===== RELATÓRIOS DE OCORRÊNCIAS =====
  
  calcularEstatisticasOcorrencias(ocorrencias: Ocorrencia[]): EstatisticasGerais {
    const totalOcorrencias = ocorrencias.length;
    
    // Ocorrências por gravidade
    const ocorrenciasPorGravidade: { [key: string]: number } = {};
    ocorrencias.forEach(o => {
      ocorrenciasPorGravidade[o.gravidade] = (ocorrenciasPorGravidade[o.gravidade] || 0) + 1;
    });
    
    // Ocorrências por mês (últimos 6 meses)
    const ocorrenciasPorMes = this.agruparPorMes(ocorrencias);
    
    // Ocorrências por turma
    const turmasMap: { [key: string]: number } = {};
    ocorrencias.forEach(o => {
      turmasMap[o.turma] = (turmasMap[o.turma] || 0) + 1;
    });
    const ocorrenciasPorTurma = Object.entries(turmasMap)
      .map(([turma, quantidade]) => ({ turma, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10); // Top 10 turmas
    
    // Top 10 alunos com mais ocorrências
    const alunosMap: { [key: string]: number } = {};
    ocorrencias.forEach(o => {
      alunosMap[o.nomeAluno] = (alunosMap[o.nomeAluno] || 0) + 1;
    });
    const topAlunos = Object.entries(alunosMap)
      .map(([nome, quantidade]) => ({ nome, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
    
    // Crescimento vs mês anterior
    const crescimentoMes = this.calcularCrescimentoMes(ocorrencias);
    
    return {
      totalOcorrencias,
      ocorrenciasPorGravidade,
      ocorrenciasPorMes,
      ocorrenciasPorTurma,
      topAlunos,
      crescimentoMes
    };
  }
  
  // ===== RELATÓRIOS DE SECRETARIA =====
  
  calcularEstatisticasSecretaria(controles: ControleEntradaSaida[]): EstatisticasSecretaria {
    const atrasos = controles.filter(c => c.tipo === 'atraso');
    const saidas = controles.filter(c => c.tipo === 'saida');
    
    return {
      totalAtrasos: atrasos.length,
      totalSaidas: saidas.length,
      atrasosPorMes: this.agruparControlesPorMes(atrasos),
      saidasPorMes: this.agruparControlesPorMes(saidas),
      atrasosPorTurma: this.agruparControlesPorTurma(atrasos)
    };
  }
  
  // ===== MÉTODOS AUXILIARES =====
  
  private agruparPorMes(ocorrencias: Ocorrencia[]): { mes: string; quantidade: number }[] {
    const hoje = new Date();
    const meses: { mes: string; quantidade: number }[] = [];
    
    // Últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const mesAno = data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      
      const quantidade = ocorrencias.filter(o => {
        const dataOcorrencia = new Date(o.data);
        return dataOcorrencia.getMonth() === data.getMonth() && 
               dataOcorrencia.getFullYear() === data.getFullYear();
      }).length;
      
      meses.push({ mes: mesAno, quantidade });
    }
    
    return meses;
  }
  
  private agruparControlesPorMes(controles: ControleEntradaSaida[]): { mes: string; quantidade: number }[] {
    const hoje = new Date();
    const meses: { mes: string; quantidade: number }[] = [];
    
    // Últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const mesAno = data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      
      const quantidade = controles.filter(c => {
        const [ano, mes] = c.data.split('-').map(Number);
        const dataControle = new Date(ano, mes - 1, 1);
        return dataControle.getMonth() === data.getMonth() && 
               dataControle.getFullYear() === data.getFullYear();
      }).length;
      
      meses.push({ mes: mesAno, quantidade });
    }
    
    return meses;
  }
  
  private agruparControlesPorTurma(controles: ControleEntradaSaida[]): { turma: string; quantidade: number }[] {
    const turmasMap: { [key: string]: number } = {};
    
    controles.forEach(c => {
      turmasMap[c.turma] = (turmasMap[c.turma] || 0) + 1;
    });
    
    return Object.entries(turmasMap)
      .map(([turma, quantidade]) => ({ turma, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
  }
  
  private calcularCrescimentoMes(ocorrencias: Ocorrencia[]): number {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
    const anoAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;
    
    const ocorrenciasMesAtual = ocorrencias.filter(o => {
      const data = new Date(o.data);
      return data.getMonth() === mesAtual && data.getFullYear() === anoAtual;
    }).length;
    
    const ocorrenciasMesAnterior = ocorrencias.filter(o => {
      const data = new Date(o.data);
      return data.getMonth() === mesAnterior && data.getFullYear() === anoAnterior;
    }).length;
    
    if (ocorrenciasMesAnterior === 0) return ocorrenciasMesAtual > 0 ? 100 : 0;
    
    return Math.round(((ocorrenciasMesAtual - ocorrenciasMesAnterior) / ocorrenciasMesAnterior) * 100);
  }
  
  // ===== EXPORTAÇÃO =====
  
  exportarParaCSV(ocorrencias: Ocorrencia[], nomeArquivo: string = 'ocorrencias'): void {
    const headers = ['Data', 'Aluno', 'Turma', 'Tipo Ensino', 'Disciplina', 'Tipo', 'Gravidade', 'Descrição', 'Professor'];
    
    const rows = ocorrencias.map(o => [
      o.data,
      o.nomeAluno,
      o.turma,
      o.tipoEnsino,
      o.disciplina,
      o.tipoOcorrencia,
      o.gravidade,
      o.descricao.replace(/,/g, ';'), // Substituir vírgulas
      o.professorNome
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const BOM = '\uFEFF'; // UTF-8 BOM para Excel reconhecer acentos
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${nomeArquivo}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
