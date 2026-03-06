import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirestoreService, Aluno } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';
import { GroupByTurmaPipe } from '../../../pipes/group-by-turma.pipe';
import * as XLSX from 'xlsx';

// Interface para armazenar info de cada aba do Excel
interface SheetMapping {
  sheetName: string;
  alunosPreview: any[];
  turmaDestino: string; // Turma que será usada no sistema
  serieDestino: string; // Série/Ano que será usada
  turmasMapeadas: any; // Mapeamento de turmas encontradas na aba (aqui vem o nome da aba)
  necessitaMapeamento: boolean; // True se a aba precisa de mapeamento
}

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
  
  // Novas propriedades para múltiplas abas
  sheetsMapping: SheetMapping[] = [];
  showMapeamento = false;
  showPreview = false;
  showList = true;
  
  loading = false;
  
  mensagem = '';
  tipoMensagem: 'sucesso' | 'erro' | 'info' = 'info';
  
  alunoEditando: Aluno | null = null;
  showModalEdicao = false;
  
  filtroAlunos = '';
  turmasExpandidas: Set<string> = new Set();
  turmaAtualImportacao = ''; // Turma sendo importada (para compatibilidade com código antigo)
  
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
        
        // Nova lógica: processar TODAS as abas
        this.sheetsMapping = [];
        let totalAlunos = 0;
        
        for (const sheetName of workbook.SheetNames) {
          console.log(`\n📌 Processando aba: "${sheetName}"`);
          
          const planilha = workbook.Sheets[sheetName];
          const json: any[] = XLSX.utils.sheet_to_json(planilha);
          
          // Normalizar as chaves (remover espaços)
          const jsonNormalizado = json.map(row => {
            const newRow: any = {};
            Object.keys(row).forEach(key => {
              const normalizedKey = key.trim();
              newRow[normalizedKey] = row[key];
            });
            return newRow;
          });
          
          // Validar e preparar dados (apenas Nome é obrigatório)
          const alunosValidos = jsonNormalizado
            .filter(row => {
              const valid = row['Nome'];
              if (!valid) {
                console.warn('⚠️ Linha inválida (falta Nome):', row);
              }
              return valid;
            })
            .map(row => ({
              nome: String(row['Nome']).trim()
            }));
          
          if (alunosValidos.length === 0) {
            console.warn(`⚠️ Nenhum aluno válido na aba "${sheetName}"`);
            continue;
          }
          
          console.log(`✅ ${alunosValidos.length} alunos válidos na aba "${sheetName}"`);
          
          // Usar o nome da aba como turma
          const turmaAba = sheetName;
          console.log(`📚 Turma detectada: "${turmaAba}"`);
          
          // Criar mapeamento para a aba
          const mapping: SheetMapping = {
            sheetName: sheetName,
            alunosPreview: alunosValidos,
            turmaDestino: turmaAba,
            serieDestino: '',
            turmasMapeadas: [turmaAba],
            necessitaMapeamento: false // Sempre temos turma pela aba
          };
          
          this.sheetsMapping.push(mapping);
          totalAlunos += alunosValidos.length;
        }
        
        if (this.sheetsMapping.length === 0) {
          console.error('❌ Nenhuma aba com dados válidos encontrada');
          this.exibirMensagem('Nenhuma aba com dados válidos encontrada. Verifique o formato', 'erro');
          return;
        }
        
        console.log(`\n✨ Total de ${totalAlunos} alunos em ${this.sheetsMapping.length} aba(s)`);
        
        // Tentar mapeamento automático e sugestão de série/ano
        this.tentarMapeamentoAutomatico();
        
        // Sempre mostrar painel de mapeamento agora (para confirmar série/ano)
        console.log('📋 Mostrando painel de mapeamento');
        this.showMapeamento = true;
        this.showPreview = false;
        this.showList = false;
        
        this.exibirMensagem(`${totalAlunos} alunos encontrados em ${this.sheetsMapping.length} aba(s)`, 'info');
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
  
  // Tentar mapear automaticamente abas (agora é mais simples, pois aba = turma)
  tentarMapeamentoAutomatico() {
    // Com a nova lógica, o nome da aba já é a turma
    // Apenas verificamos se precisamos de série/ano
    for (const sheet of this.sheetsMapping) {
      // Tentar detectar série/ano sugerido pelo nome da aba
      // Ex: "6A" → "6º ano", "1A" → "1º ano EM"
      if (!sheet.serieDestino) {
        sheet.serieDestino = this.sugerirSerieAno(sheet.turmaDestino);
        console.log(`✅ Série/Ano sugerida para "${sheet.turmaDestino}": "${sheet.serieDestino}"`);
      }
    }
  }
  
  // Sugerir série/ano baseado no padrão do nome da turma
  sugerirSerieAno(nomeTurma: string): string {
    // Extrair número do começo (ex: "6A" → 6)
    const match = nomeTurma.match(/^(\d+)/);
    if (match) {
      const numero = parseInt(match[1]);
      if (numero >= 1 && numero <= 9) {
        return `${numero}º ano`;
      } else if (numero >= 10 && numero <= 12) {
        return `${numero - 9}º ano EM`;
      }
    }
    return '';
  }
  
  // Preparar preview unificado (agrupa todas as abas)
  prepararPreview() {
    this.alunosPreview = [];
    for (const sheet of this.sheetsMapping) {
      this.alunosPreview.push(...sheet.alunosPreview);
    }
  }
  
  // Confirmar mapeamento e ir para preview
  confirmarMapeamento() {
    // Validar que todas as abas tem turma e série/ano definidas
    const abasInvalidas = this.sheetsMapping.filter(s => !s.turmaDestino || !s.serieDestino);
    if (abasInvalidas.length > 0) {
      this.exibirMensagem('Por favor, defina a série/ano para todas as abas', 'erro');
      return;
    }
    
    console.log('✅ Mapeamento confirmado!');
    this.prepararPreview();
    this.showMapeamento = false;
    this.showPreview = true;
    this.cdr.markForCheck();
  }
  
  async importarAlunos() {
    try {
      console.log('🚀 Iniciando importação de alunos...');
      
      if (this.sheetsMapping.length === 0) {
        console.error('❌ Nenhuma aba para importar');
        this.exibirMensagem('Nenhuma aba para importar', 'erro');
        return;
      }
      
      this.loading = true;
      let totalImportados = 0;
      const turmasProcessadas = new Set<string>();
      
      // Processar cada aba
      for (const sheet of this.sheetsMapping) {
        console.log(`\n📝 Processando aba "${sheet.sheetName}"...`);
        
        // Se a turma destino ainda não foi processada, limpar alunos antigos
        if (!turmasProcessadas.has(sheet.turmaDestino)) {
          const alunosAntigos = this.alunos.filter(a => a.turma === sheet.turmaDestino);
          if (alunosAntigos.length > 0) {
            console.log(`🗑️ Deletando ${alunosAntigos.length} alunos antigos da turma "${sheet.turmaDestino}"...`);
            for (const aluno of alunosAntigos) {
              if (aluno.id) {
                await this.firestoreService.deletarAluno(aluno.id);
              }
            }
          }
          turmasProcessadas.add(sheet.turmaDestino);
        }
        
        // Preparar alunos com a turma e série/ano destino
        const alunosParaImportar = sheet.alunosPreview.map(a => ({
          nome: a.nome,
          turma: sheet.turmaDestino,
          serie: sheet.serieDestino
        }));
        
        console.log(`📥 Importando ${alunosParaImportar.length} alunos para turma "${sheet.turmaDestino}"...`);
        const contador = await this.firestoreService.importarAlunos(this.escolaId, alunosParaImportar);
        
        console.log(`✅ ${contador} alunos importados`);
        totalImportados += contador;
      }
      
      console.log(`\n✨ Total: ${totalImportados} alunos importados`);
      
      this.sheetsMapping = [];
      this.alunosPreview = [];
      this.turmaAtualImportacao = '';
      this.showMapeamento = false;
      this.showPreview = false;
      this.showList = true;
      this.turmasExpandidas.clear();
      
      await this.carregarAlunos();
      this.exibirMensagem(`✅ ${totalImportados} alunos importados com sucesso!`, 'sucesso');
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
    this.sheetsMapping = [];
    this.showMapeamento = false;
    this.showPreview = false;
    this.showList = false;
    this.turmaAtualImportacao = '';
  }
  
  reimportar() {
    this.filtroAlunos = '';
    this.showList = false;
    this.showPreview = false;
    this.showMapeamento = false;
    this.sheetsMapping = [];
    this.alunosPreview = [];
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
  
  async deletarTurma(turma: string) {
    try {
      const alunosDaTurma = this.alunos.filter(a => a.turma === turma);
      
      if (!confirm(`Deseja deletar a turma "${turma}" inteira? (${alunosDaTurma.length} alunos serão removidos)`)) {
        return;
      }
      
      this.loading = true;
      console.log(`🗑️ Deletando turma "${turma}" com ${alunosDaTurma.length} alunos...`);
      
      // Deletar todos os alunos da turma
      for (const aluno of alunosDaTurma) {
        if (aluno.id) {
          await this.firestoreService.deletarAluno(aluno.id);
        }
      }
      
      console.log(`✅ ${alunosDaTurma.length} alunos deletados`);
      await this.carregarAlunos();
      this.exibirMensagem(`✅ Turma "${turma}" deletada com sucesso! (${alunosDaTurma.length} alunos removidos)`, 'sucesso');
      this.cdr.markForCheck();
      
    } catch (error) {
      console.error('Erro ao deletar turma:', error);
      this.exibirMensagem('Erro ao deletar turma', 'erro');
    } finally {
      this.loading = false;
    }
  }
  
  async limparHistoricoFaltas(turma: string) {
    try {
      const faltasQtd = await this.firestoreService.deletarFaltasDaTurma(this.escolaId, turma);
      
      if (faltasQtd === 0) {
        this.exibirMensagem(`ℹ️ Nenhuma falta encontrada para turma "${turma}"`, 'info');
        return;
      }
      
      if (!confirm(`Deseja deletar permanentemente o histórico de ${faltasQtd} faltas da turma "${turma}"? Esta ação não pode ser desfeita.`)) {
        return;
      }
      
      this.loading = true;
      console.log(`🧹 Limpando histórico de faltas da turma "${turma}"...`);
      
      const deletados = await this.firestoreService.deletarFaltasDaTurma(this.escolaId, turma);
      
      console.log(`✅ ${deletados} faltas deletadas`);
      this.exibirMensagem(`✅ Histórico limpo! ${deletados} faltas removidas da turma "${turma}"`, 'sucesso');
      
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
      this.exibirMensagem('Erro ao limpar histórico de faltas', 'erro');
    } finally {
      this.loading = false;
    }
  }
  
  fecharModalEdicao() {
    this.showModalEdicao = false;
    this.alunoEditando = null;
  }
  
  downloadTemplate() {
    // Criar workbook com múltiplas abas como exemplo
    const workbook = XLSX.utils.book_new();
    
    // Aba 1: Turma 6A
    const dados6A = [
      { Nome: 'João Silva' },
      { Nome: 'Maria Santos' },
      { Nome: 'Pedro Oliveira' },
      { Nome: 'Ana Costa' }
    ];
    const sheet6A = XLSX.utils.json_to_sheet(dados6A);
    XLSX.utils.book_append_sheet(workbook, sheet6A, '6A');
    
    // Aba 2: Turma 7B
    const dados7B = [
      { Nome: 'Lucas Ferreira' },
      { Nome: 'Beatriz Lima' },
      { Nome: 'Carlos Mendes' }
    ];
    const sheet7B = XLSX.utils.json_to_sheet(dados7B);
    XLSX.utils.book_append_sheet(workbook, sheet7B, '7B');
    
    // Aba 3: Turma 8C
    const dados8C = [
      { Nome: 'Fernanda Gomes' },
      { Nome: 'Rafael Dias' }
    ];
    const sheet8C = XLSX.utils.json_to_sheet(dados8C);
    XLSX.utils.book_append_sheet(workbook, sheet8C, '8C');
    
    XLSX.writeFile(workbook, 'template_alunos_multiplas_turmas.xlsx');
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
