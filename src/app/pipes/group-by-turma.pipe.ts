import { Pipe, PipeTransform } from '@angular/core';
import { Aluno } from '../services/firestore';

@Pipe({
  name: 'groupByTurma',
  standalone: true
})
export class GroupByTurmaPipe implements PipeTransform {
  transform(alunos: Aluno[]): any[] {
    if (!alunos || alunos.length === 0) {
      return [];
    }

    // Agrupar alunos por turma
    const grupos = alunos.reduce((acc: any, aluno) => {
      const turmaExistente = acc.find((g: any) => g.turma === aluno.turma);
      
      if (turmaExistente) {
        turmaExistente.alunos.push(aluno);
      } else {
        acc.push({
          turma: aluno.turma,
          alunos: [aluno]
        });
      }
      
      return acc;
    }, []);

    // Ordenar alfabeticamente por turma
    return grupos.sort((a: any, b: any) => a.turma.localeCompare(b.turma));
  }
}
