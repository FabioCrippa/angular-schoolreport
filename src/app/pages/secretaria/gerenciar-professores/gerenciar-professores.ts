import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirestoreService, DadosFuncionaisProfessor } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';

interface ProfessorComDados {
  id: string;
  nome: string;
  dados: DadosFuncionaisProfessor | null;
  editando: boolean;
  salvando: boolean;
}

@Component({
  selector: 'app-gerenciar-professores',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gerenciar-professores.html',
  styleUrl: './gerenciar-professores.scss'
})
export class GerenciarProfessores implements OnInit {

  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  loading = true;
  escolaId = '';
  usuarioNome = '';
  mensagem = '';
  tipoMensagem: 'sucesso' | 'erro' = 'sucesso';

  professores: ProfessorComDados[] = [];
  filtro = '';
  professorAtivoId: string | null = null;

  // form isolado por professor
  forms: Record<string, {
    nomeCompleto: string; dataNascimento: string; sexo: string;
    rg: string; cpf: string; matricula: string;
    cargo: string; categoria: string; orgaoClassificacao: string;
    municipio: string; lotacao: string; pisPasep: string;
    horarioTrabalho: string; horarioEstudante: string; localFuncao: string;
    inicioNoCargo: string; inicioServicoPublico: string; acumulaCargo: string;
    observacoes: string;
  }> = {};

  get professoresFiltrados(): ProfessorComDados[] {
    const t = this.filtro.toLowerCase();
    return t ? this.professores.filter(p => p.nome.toLowerCase().includes(t)) : this.professores;
  }

  get qtdCompletos(): number {
    return this.professores.filter(p => this.dadosCompletos(p)).length;
  }

  ngOnInit() {
    this.carregarDados();
  }

  async carregarDados() {
    try {
      this.loading = true;
      const user = this.authService.getCurrentUser();
      if (!user) return;

      const usuario = await this.firestoreService.buscarUsuario(user.uid);
      if (!usuario) return;

      this.escolaId = usuario.escolaId;
      this.usuarioNome = usuario.nome;

      const [listaUsuarios, listaDados] = await Promise.all([
        this.firestoreService.listarProfessoresDaEscola(usuario.escolaId),
        this.firestoreService.listarDadosFuncionaisProfessores(usuario.escolaId)
      ]);

      const mapaFuncionais = new Map(listaDados.map(d => [d.professorId, d]));

      this.professores = listaUsuarios.map(p => ({
        id: p.id,
        nome: p.nome,
        dados: mapaFuncionais.get(p.id) ?? null,
        editando: false,
        salvando: false
      }));

      // Inicializar forms
      for (const p of this.professores) {
        this.forms[p.id] = {
          nomeCompleto: p.dados?.nomeCompleto ?? p.nome,
          dataNascimento: p.dados?.dataNascimento ?? '',
          sexo: p.dados?.sexo ?? '',
          rg: p.dados?.rg ?? '',
          cpf: p.dados?.cpf ?? '',
          matricula: p.dados?.matricula ?? '',
          cargo: p.dados?.cargo ?? '',
          categoria: p.dados?.categoria ?? '',
          orgaoClassificacao: p.dados?.orgaoClassificacao ?? '',
          municipio: p.dados?.municipio ?? '',
          lotacao: p.dados?.lotacao ?? '',
          pisPasep: p.dados?.pisPasep ?? '',
          horarioTrabalho: p.dados?.horarioTrabalho ?? '',
          horarioEstudante: p.dados?.horarioEstudante ?? '',
          localFuncao: p.dados?.localFuncao ?? '',
          inicioNoCargo: p.dados?.inicioNoCargo ?? '',
          inicioServicoPublico: p.dados?.inicioServicoPublico ?? '',
          acumulaCargo: p.dados?.acumulaCargo ?? '',
          observacoes: p.dados?.observacoes ?? ''
        };
      }
    } catch (error) {
      console.error('Erro ao carregar professores:', error);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  abrirForm(professor: ProfessorComDados) {
    if (this.professorAtivoId === professor.id) {
      this.professorAtivoId = null;
      professor.editando = false;
    } else {
      // Fechar o anterior
      if (this.professorAtivoId) {
        const anterior = this.professores.find(p => p.id === this.professorAtivoId);
        if (anterior) anterior.editando = false;
      }
      this.professorAtivoId = professor.id;
      professor.editando = true;
    }
    this.cdr.markForCheck();
  }

  cancelarEdicao(professor: ProfessorComDados) {
    // Restaurar valores originais
    const d = professor.dados;
    this.forms[professor.id] = {
      nomeCompleto: d?.nomeCompleto ?? professor.nome,
      dataNascimento: d?.dataNascimento ?? '',
      sexo: d?.sexo ?? '',
      rg: d?.rg ?? '',
      cpf: d?.cpf ?? '',
      matricula: d?.matricula ?? '',
      cargo: d?.cargo ?? '',
      categoria: d?.categoria ?? '',
      orgaoClassificacao: d?.orgaoClassificacao ?? '',
      municipio: d?.municipio ?? '',
      lotacao: d?.lotacao ?? '',
      pisPasep: d?.pisPasep ?? '',
      horarioTrabalho: d?.horarioTrabalho ?? '',
      horarioEstudante: d?.horarioEstudante ?? '',
      localFuncao: d?.localFuncao ?? '',
      inicioNoCargo: d?.inicioNoCargo ?? '',
      inicioServicoPublico: d?.inicioServicoPublico ?? '',
      acumulaCargo: d?.acumulaCargo ?? '',
      observacoes: d?.observacoes ?? ''
    };
    professor.editando = false;
    this.professorAtivoId = null;
    this.cdr.markForCheck();
  }

  async salvar(professor: ProfessorComDados) {
    try {
      professor.salvando = true;
      this.cdr.markForCheck();

      const f = this.forms[professor.id];
      await this.firestoreService.salvarDadosFuncionaisProfessor({
        professorId: professor.id,
        escolaId: this.escolaId,
        nomeCompleto: f.nomeCompleto,
        dataNascimento: f.dataNascimento,
        sexo: f.sexo,
        rg: f.rg,
        cpf: f.cpf,
        matricula: f.matricula,
        cargo: f.cargo,
        categoria: f.categoria,
        orgaoClassificacao: f.orgaoClassificacao,
        municipio: f.municipio,
        lotacao: f.lotacao,
        pisPasep: f.pisPasep,
        horarioTrabalho: f.horarioTrabalho,
        horarioEstudante: f.horarioEstudante,
        localFuncao: f.localFuncao,
        inicioNoCargo: f.inicioNoCargo,
        inicioServicoPublico: f.inicioServicoPublico,
        acumulaCargo: f.acumulaCargo,
        observacoes: f.observacoes,
        atualizadoPor: this.usuarioNome
      });

      // Atualizar dados locais
      professor.dados = { professorId: professor.id, escolaId: this.escolaId, ...f };
      professor.editando = false;
      this.professorAtivoId = null;
      this.exibirMensagem(`Dados de ${professor.nome} salvos com sucesso!`, 'sucesso');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      this.exibirMensagem('Erro ao salvar. Tente novamente.', 'erro');
    } finally {
      professor.salvando = false;
      this.cdr.markForCheck();
    }
  }

  dadosCompletos(professor: ProfessorComDados): boolean {
    const d = professor.dados;
    return !!(d && d.nomeCompleto && d.rg && d.cpf && d.matricula);
  }

  exibirMensagem(texto: string, tipo: 'sucesso' | 'erro') {
    this.mensagem = texto;
    this.tipoMensagem = tipo;
    this.cdr.markForCheck();
    setTimeout(() => { this.mensagem = ''; this.cdr.markForCheck(); }, 5000);
  }

  voltar() {
    this.router.navigate(['/secretaria/dashboard']);
  }
}
