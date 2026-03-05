import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirestoreService, Aluno } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';
import { GroupByTurmaPipe } from '../../../pipes/group-by-turma.pipe';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-gerenciar-alunos',
  standalone: true,
  imports: [CommonModule, FormsModule, GroupByTurmaPipe],
  templateUrl: './gerenciar-alunos.html',
  styleUrl: './gerenciar-alunos.scss'
})
export class GerenciarAlunos implements OnInit {
  
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  
  escolaId = '';
  alunos: Aluno[] = [];
  alunosPreview: any[] = [];
  
  loading = false;
  showPreview = false;
  showList = true;
  
  mensagem = '';
  tipoMensagem: 'sucesso' | 'erro' | 'info' = 'info';
  
  alunoEditando: Aluno | null = null;
  showModalEdicao = false;
  
  filtroAlunos = '';
  turmasExpandidas: Set<string> = new Set();
  turmaAtualImportacao = ''; // Turma sendo importada
  
  ngOnInit() {
    this.carregarDados();
  }
  
  get alunosFiltrados(): Aluno[] {
    if (!this.filtroAlunos.trim()) {
      return this.alunos;
    }
    
    const termo = this.filtroAlunos.toLowerCase();
    return this.alunos.filter(aluno => 
      aluno.nome.toLowerCase().includes(termo) ||
      aluno.turma.toLowerCase().includes(termo) ||
      aluno.serie.toLowerCase().includes(termo)
    );
  }
  
  async carregarDados() {
    try {
      const user = this.authService.getCurrentUser();
      if (user) {
        const usuario = await this.firestoreService.buscarUsuario(user.uid);
        if (usuario) {
          this.escolaId = usuario.escolaId;
          await this.carregarAlunos();
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      this.exibirMensagem('Erro ao carregar dados', 'erro');
    }
  }
  
  async carregarAlunos() {
    try {
      this.loading = true;
      this.alunos = await this.firestoreService.obterAlunos(this.escolaId);
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
      this.exibirMensagem('Erro ao carregar alunos', 'erro');
    } finally {
      this.loading = false;
    }
  }
  
  aoSelecionarArquivo(event: any) {
    const arquivo = event.target.files[0];
    
    console.log('📁 Arquivo selecionado:', arquivo);
    
    if (!arquivo) {
      console.warn('⚠️ Nenhum arquivo selecionado');
      return;
    }
    
    // Validar se é um arquivo Excel
    if (!arquivo.name.endsWith('.xlsx') && !arquivo.name.endsWith('.xls') && !arquivo.name.endsWith('.csv')) {
      console.error('❌ Formato inválido:', arquivo.name);
      this.exibirMensagem('Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV', 'erro');
      return;
    }
    
    console.log('✅ Arquivo válido, processando...');
    
    const reader = new FileReader();
    
    reader.onload = (e: any) => {
      try {
        console.log('📖 Lendo arquivo...');
        const dados = e.target.result;
        console.log('📊 Dados brutos recebidos, tamanho:', dados.length);
        
        const workbook = XLSX.read(dados, { type: 'binary' });
        console.log('📋 Abas disponíveis:', workbook.SheetNames);
        
        const primeiraAba = workbook.SheetNames[0];
        console.log('📌 Primeira aba:', primeiraAba);
        
        const planilha = workbook.Sheets[primeiraAba];
        console.log('📄 Planilha carregada');
        
        const json: any[] = XLSX.utils.sheet_to_json(planilha);
        console.log('🔄 JSON convertido, linhas:', json.length);
        console.log('📑 Primeiras linhas:', json.slice(0, 3));
        
        // Normalizar as chaves (remover espaços, fazer lowercase)
        const jsonNormalizado = json.map(row => {
          const newRow: any = {};
          Object.keys(row).forEach(key => {
            const normalizedKey = key.trim();
            newRow[normalizedKey] = row[key];
          });
          return newRow;
        });
        
        console.log('📑 Primeiras linhas normalizadas:', jsonNormalizado.slice(0, 3));
        
        // Validar e preparar dados
        this.alunosPreview = jsonNormalizado
          .filter(row => {
            const valid = row['Nome'] && row['Turma'] && row['Série/Ano'];
            if (!valid) {
              console.warn('⚠️ Linha inválida (faltam campos):', row);
            }
            return valid;
          })
          .map(row => ({
            nome: String(row['Nome']).trim(),
            turma: String(row['Turma']).trim(),
            serie: String(row['Série/Ano']).trim()
          }));
        
        // Detectar turma(s) no arquivo
        const turmasNoArquivo = [...new Set(this.alunosPreview.map(a => a.turma))];
        if (turmasNoArquivo.length === 1) {
          this.turmaAtualImportacao = turmasNoArquivo[0];
          console.log('🎯 Turma detectada:', this.turmaAtualImportacao);
        } else if (turmasNoArquivo.length > 1) {
          console.warn('⚠️ Arquivo contém múltiplas turmas:', turmasNoArquivo);
          this.turmaAtualImportacao = '';
        }
        
        console.log('✅ Alunos filtrados:', this.alunosPreview.length);
        
        if (this.alunosPreview.length === 0) {
          console.error('❌ Nenhum aluno válido encontrado');
          this.exibirMensagem('Nenhum aluno válido encontrado. Verifique as colunas: Nome, Turma, Série/Ano', 'erro');
          return;
        }
        
        this.showPreview = true;
        this.showList = false;
        this.exibirMensagem(`${this.alunosPreview.length} alunos encontrados para importação`, 'info');
        console.log('✨ Preview carregado com sucesso');
        this.cdr.markForCheck();
        
      } catch (error) {
        console.error('❌ Erro ao processar arquivo:', error);
        this.exibirMensagem('Erro ao processar arquivo. Verifique o formato', 'erro');
      }
    };
    
    reader.onerror = (error) => {
      console.error('❌ Erro ao ler arquivo:', error);
      this.exibirMensagem('Erro ao ler o arquivo', 'erro');
    };
    
    reader.readAsBinaryString(arquivo);
  }
  
  async importarAlunos() {
    try {
      console.log('🚀 Iniciando importação de alunos...');
      
      if (this.alunosPreview.length === 0) {
        console.error('❌ Nenhum aluno para importar');
        this.exibirMensagem('Nenhum aluno para importar', 'erro');
        return;
      }
      
      console.log('📝 Alunos a importar:', this.alunosPreview.length);
      this.loading = true;
      
      // Verificar se é turma existente (reimportação) ou nova
      const turmasNoArquivo = [...new Set(this.alunosPreview.map(a => a.turma))];
      const turmaExistenteNoSistema = this.alunos.some(a => a.turma === this.turmaAtualImportacao);
      
      if (turmaExistenteNoSistema && this.turmaAtualImportacao) {
        // É reimportação da mesma turma: deletar antigos dessa turma
        console.log(`🔄 Reimportando turma "${this.turmaAtualImportacao}"...`);
        console.log('🗑️ Deletando alunos antigos dessa turma...');
        
        const alunosAntigos = this.alunos.filter(a => a.turma === this.turmaAtualImportacao);
        for (const aluno of alunosAntigos) {
          if (aluno.id) {
            await this.firestoreService.deletarAluno(aluno.id);
          }
        }
        console.log(`✅ ${alunosAntigos.length} alunos antigos deletados`);
      } else if (turmasNoArquivo.length > 1) {
        // Múltiplas turmas: deletar todas as turmas do arquivo
        console.log('📚 Múltiplas turmas detectadas, atualizando todas...');
        console.log('🗑️ Deletando alunos antigos das turmas...');
        
        for (const turma of turmasNoArquivo) {
          const alunosAntigos = this.alunos.filter(a => a.turma === turma);
          for (const aluno of alunosAntigos) {
            if (aluno.id) {
              await this.firestoreService.deletarAluno(aluno.id);
            }
          }
        }
        console.log('✅ Alunos antigos deletados');
      } else {
        // Turma nova: apenas adicionar
        console.log(`✨ Nova turma detectada: "${this.turmaAtualImportacao}"`);
      }
      
      // Importar os novos alunos
      console.log('📥 Importando novos alunos...');
      const contador = await this.firestoreService.importarAlunos(this.escolaId, this.alunosPreview);
      
      console.log(`✨ ${contador} alunos importados com sucesso`);
      
      this.alunosPreview = [];
      this.turmaAtualImportacao = '';
      this.showPreview = false;
      this.showList = true;
      this.turmasExpandidas.clear(); // Limpar turmas expandidas
      
      await this.carregarAlunos();
      this.exibirMensagem(`✅ ${contador} alunos importados com sucesso!`, 'sucesso');
      this.cdr.markForCheck();
      
    } catch (error) {
      console.error('❌ Erro ao importar alunos:', error);
      this.exibirMensagem('Erro ao importar alunos', 'erro');
    } finally {
      this.loading = false;
    }
  }
  
  cancelarImportacao() {
    this.alunosPreview = [];
    this.showPreview = false;
    this.showList = false;
    this.turmaAtualImportacao = '';
  }
  
  reimportar() {
    this.filtroAlunos = '';
    this.showList = false;
    this.showPreview = false;
  }
  
  toggleTurma(turma: string) {
    if (this.turmasExpandidas.has(turma)) {
      this.turmasExpandidas.delete(turma);
    } else {
      this.turmasExpandidas.add(turma);
    }
  }
  
  isTurmaExpandida(turma: string): boolean {
    return this.turmasExpandidas.has(turma);
  }
  
  isTurmaExistente(): boolean {
    return this.alunos.some(a => a.turma === this.turmaAtualImportacao);
  }
  
  isTurmaNova(): boolean {
    return !!this.turmaAtualImportacao && !this.isTurmaExistente();
  }
  
  temMultiplasTurmas(): boolean {
    return !this.turmaAtualImportacao;
  }
  
  abrirEdicao(aluno: Aluno) {
    this.alunoEditando = { ...aluno };
    this.showModalEdicao = true;
  }
  
  async salvarEdicao() {
    try {
      if (!this.alunoEditando || !this.alunoEditando.id) {
        return;
      }
      
      this.loading = true;
      await this.firestoreService.atualizarAluno(this.alunoEditando.id, this.alunoEditando);
      
      await this.carregarAlunos();
      this.fecharModalEdicao();
      this.exibirMensagem('✅ Aluno atualizado com sucesso!', 'sucesso');
      this.cdr.markForCheck();
      
    } catch (error) {
      console.error('Erro ao atualizar aluno:', error);
      this.exibirMensagem('Erro ao atualizar aluno', 'erro');
    } finally {
      this.loading = false;
    }
  }
  
  async deletarAluno(aluno: Aluno) {
    try {
      if (!confirm(`Deseja deletar o aluno ${aluno.nome}?`)) {
        return;
      }
      
      if (!aluno.id) {
        return;
      }
      
      this.loading = true;
      await this.firestoreService.deletarAluno(aluno.id);
      
      await this.carregarAlunos();
      this.exibirMensagem('✅ Aluno deletado com sucesso!', 'sucesso');
      this.cdr.markForCheck();
      
    } catch (error) {
      console.error('Erro ao deletar aluno:', error);
      this.exibirMensagem('Erro ao deletar aluno', 'erro');
    } finally {
      this.loading = false;
    }
  }
  
  fecharModalEdicao() {
    this.showModalEdicao = false;
    this.alunoEditando = null;
  }
  
  downloadTemplate() {
    const dados = [
      { Nome: 'João Silva', Turma: 'Turma A', 'Série/Ano': '7º ano' },
      { Nome: 'Maria Santos', Turma: 'Turma A', 'Série/Ano': '7º ano' },
      { Nome: 'Pedro Oliveira', Turma: 'Turma B', 'Série/Ano': '8º ano' }
    ];
    
    const planilha = XLSX.utils.json_to_sheet(dados);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, planilha, 'Alunos');
    XLSX.writeFile(workbook, 'template_alunos.xlsx');
  }
  
  exibirMensagem(texto: string, tipo: 'sucesso' | 'erro' | 'info') {
    this.mensagem = texto;
    this.tipoMensagem = tipo;
    
    setTimeout(() => {
      this.mensagem = '';
    }, 4000);
  }

  voltar() {
    this.router.navigate(['/secretaria/dashboard']);
  }
}
