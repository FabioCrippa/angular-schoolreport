import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirestoreService, FaltaProfessor, DadosFuncionaisProfessor } from '../../../services/firestore';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-ficha100-professor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ficha100-professor.html',
  styleUrl: './ficha100-professor.scss'
})
export class Ficha100Professor implements OnInit {

  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  loading = false;
  carregandoFicha = false;
  salvandoDados = false;
  exportandoPdf = false;
  mensagem = '';
  tipoMensagem: 'sucesso' | 'erro' = 'sucesso';

  escolaId = '';
  escolaNome = '';
  usuarioId = '';
  usuarioNome = '';

  professores: { id: string; nome: string }[] = [];
  professorSelecionado = '';
  anoSelecionado = new Date().getFullYear();

  get anos(): number[] {
    const atual = new Date().getFullYear();
    return [atual - 2, atual - 1, atual, atual + 1];
  }

  faltas: FaltaProfessor[] = [];
  dadosFuncionais: DadosFuncionaisProfessor | null = null;
  editandoDados = false;

  formDados = {
    nomeCompleto: '',
    rg: '',
    cpf: '',
    matricula: '',
    cargo: '',
    lotacao: '',
    pisPasep: ''
  };

  meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  mesesAbrev = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

  dias = Array.from({ length: 31 }, (_, i) => i + 1);

  // grade[diaIndex][mesIndex] = tipoAfastamento code or ''
  grade: string[][] = [];

  fichaCarregada = false;

  tiposAfastamento = [
    { sigla: 'FM', desc: 'Falta com Motivo' },
    { sigla: 'J', desc: 'Justificada' },
    { sigla: 'I', desc: 'Injustificada' },
    { sigla: 'F', desc: 'Falta' },
    { sigla: 'LS', desc: 'Licença Saúde' },
    { sigla: 'LG', desc: 'Licença Gestante' },
    { sigla: 'LP', desc: 'Licença Paternidade' },
    { sigla: 'N', desc: 'Nojo (Luto)' },
    { sigla: 'RE', desc: 'Representação' },
    { sigla: 'SP', desc: 'Serviço de Ponto' }
  ];

  ngOnInit() {
    this.carregarProfessores();
  }

  async carregarProfessores() {
    try {
      this.loading = true;
      const user = this.authService.getCurrentUser();
      if (user) {
        const usuario = await this.firestoreService.buscarUsuario(user.uid);
        if (usuario) {
          this.escolaId = usuario.escolaId;
          this.usuarioId = user.uid;
          this.usuarioNome = usuario.nome;
          this.professores = await this.firestoreService.listarProfessoresDaEscola(usuario.escolaId);
          const escola = await this.firestoreService.buscarEscola(usuario.escolaId);
          this.escolaNome = escola?.nome || '';
        }
      }
    } catch (error) {
      console.error('Erro ao carregar professores:', error);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async carregarFicha() {
    if (!this.professorSelecionado) return;

    try {
      this.carregandoFicha = true;
      this.fichaCarregada = false;

      // Load absences and functional data in parallel
      const [todasFaltas, profId] = await Promise.all([
        this.firestoreService.obterFaltasProfessores(this.escolaId),
        Promise.resolve(this.professores.find(p => p.nome === this.professorSelecionado)?.id ?? '')
      ]);

      this.faltas = todasFaltas.filter(f =>
        f.professorNome === this.professorSelecionado &&
        f.data.startsWith(this.anoSelecionado.toString())
      );

      if (profId) {
        this.dadosFuncionais = await this.firestoreService.buscarDadosFuncionaisProfessor(profId);
        if (this.dadosFuncionais) {
          this.formDados = {
            nomeCompleto: this.dadosFuncionais.nomeCompleto,
            rg: this.dadosFuncionais.rg,
            cpf: this.dadosFuncionais.cpf,
            matricula: this.dadosFuncionais.matricula,
            cargo: this.dadosFuncionais.cargo,
            lotacao: this.dadosFuncionais.lotacao,
            pisPasep: this.dadosFuncionais.pisPasep
          };
          this.editandoDados = false;
        } else {
          // No functional data yet — open form pre-filled with the professor's display name
          this.formDados = { nomeCompleto: this.professorSelecionado, rg: '', cpf: '', matricula: '', cargo: '', lotacao: '', pisPasep: '' };
          this.editandoDados = true;
        }
      }

      this.construirGrade();
      this.fichaCarregada = true;
    } catch (error) {
      console.error('Erro ao carregar ficha:', error);
    } finally {
      this.carregandoFicha = false;
      this.cdr.markForCheck();
    }
  }

  construirGrade() {
    this.grade = Array.from({ length: 31 }, () => Array(12).fill(''));
    for (const falta of this.faltas) {
      const parts = falta.data.split('-');
      if (parts.length !== 3) continue;
      const mes = parseInt(parts[1], 10) - 1;
      const dia = parseInt(parts[2], 10) - 1;
      if (dia >= 0 && dia < 31 && mes >= 0 && mes < 12) {
        this.grade[dia][mes] = falta.tipoAfastamento || 'F';
      }
    }
  }

  async salvarDadosFuncionais() {
    const prof = this.professores.find(p => p.nome === this.professorSelecionado);
    if (!prof) return;

    try {
      this.salvandoDados = true;
      await this.firestoreService.salvarDadosFuncionaisProfessor({
        professorId: prof.id,
        escolaId: this.escolaId,
        ...this.formDados,
        atualizadoPor: this.usuarioNome
      });
      this.dadosFuncionais = { professorId: prof.id, escolaId: this.escolaId, ...this.formDados };
      this.editandoDados = false;
      this.exibirMensagem('Dados funcionais salvos com sucesso!', 'sucesso');
    } catch (error) {
      console.error('Erro ao salvar dados funcionais:', error);
      this.exibirMensagem('Erro ao salvar dados. Tente novamente.', 'erro');
    } finally {
      this.salvandoDados = false;
      this.cdr.markForCheck();
    }
  }

  contarPorTipo(sigla: string): number {
    return this.faltas.filter(f => (f.tipoAfastamento || 'F') === sigla).length;
  }

  totalFaltas(): number {
    return this.faltas.length;
  }

  contarPorMes(mesIndex: number): number {
    return this.grade.filter(row => row[mesIndex] !== '').length;
  }

  async exportarPDF() {
    if (!this.fichaCarregada) return;

    try {
      this.exportandoPdf = true;
      this.cdr.markForCheck();

      const pdfMake = await import('pdfmake/build/pdfmake');
      const pdfFonts = await import('pdfmake/build/vfs_fonts');
      (pdfMake as any).default.vfs = (pdfFonts as any).default;

      const nomeProf = this.dadosFuncionais?.nomeCompleto || this.professorSelecionado;

      // Build main grid table body
      const tableBody: any[][] = [];

      // Header row
      tableBody.push([
        { text: 'DIA', style: 'thCell' },
        ...this.mesesAbrev.map(m => ({ text: m, style: 'thCell' }))
      ]);

      // Day rows
      for (let d = 0; d < 31; d++) {
        const row: any[] = [{ text: String(d + 1), alignment: 'center', fontSize: 8 }];
        for (let m = 0; m < 12; m++) {
          const val = this.grade[d][m];
          row.push({
            text: val,
            alignment: 'center',
            fontSize: 8,
            bold: !!val,
            fillColor: val ? '#DBEAFE' : null,
            color: val ? '#1E40AF' : '#000000'
          });
        }
        tableBody.push(row);
      }

      // Totals row
      const totaisRow: any[] = [{ text: 'TOTAL', style: 'thCell', fontSize: 7 }];
      for (let m = 0; m < 12; m++) {
        const count = this.contarPorMes(m);
        totaisRow.push({ text: count > 0 ? String(count) : '', alignment: 'center', fontSize: 8, bold: true });
      }
      tableBody.push(totaisRow);

      // Summary table body
      const summaryBody = [
        this.tiposAfastamento.map(t => ({ text: t.sigla, style: 'thCell', fontSize: 8 })),
        this.tiposAfastamento.map(t => ({ text: String(this.contarPorTipo(t.sigla)), alignment: 'center', fontSize: 9 }))
      ];

      const docDefinition: any = {
        pageOrientation: 'landscape',
        pageMargins: [20, 20, 20, 20],
        content: [
          { text: 'FICHA DE FREQUÊNCIA DO PROFESSOR (FICHA 100)', style: 'title' },
          { text: `Ano Letivo: ${this.anoSelecionado}${this.escolaNome ? '   |   ' + this.escolaNome : ''}`, style: 'subtitle' },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 800, y2: 0, lineWidth: 0.8, lineColor: '#9CA3AF' }], margin: [0, 4, 0, 6] },
          {
            columns: [
              { text: `Nome: ${nomeProf}`, fontSize: 9, width: '*' },
              { text: `Matrícula: ${this.dadosFuncionais?.matricula || '___________'}`, fontSize: 9, width: 160 },
              { text: `Cargo: ${this.dadosFuncionais?.cargo || '___________'}`, fontSize: 9, width: 160 }
            ],
            margin: [0, 0, 0, 4]
          },
          {
            columns: [
              { text: `RG: ${this.dadosFuncionais?.rg || '___________'}`, fontSize: 9, width: 140 },
              { text: `CPF: ${this.dadosFuncionais?.cpf || '___________'}`, fontSize: 9, width: 160 },
              { text: `PIS/PASEP: ${this.dadosFuncionais?.pisPasep || '___________'}`, fontSize: 9, width: '*' },
              { text: `Lotação: ${this.dadosFuncionais?.lotacao || '___________'}`, fontSize: 9, width: 160 }
            ],
            margin: [0, 0, 0, 8]
          },
          {
            table: {
              headerRows: 1,
              widths: [22, ...Array(12).fill('*')],
              body: tableBody
            },
            layout: {
              hLineWidth: () => 0.4,
              vLineWidth: () => 0.4,
              hLineColor: () => '#9CA3AF',
              vLineColor: () => '#9CA3AF'
            }
          },
          {
            text: 'LEGENDA: FM=Falta c/Motivo  |  J=Justificada  |  I=Injustificada  |  F=Falta  |  LS=Lic.Saúde  |  LG=Lic.Gestante  |  LP=Lic.Paternidade  |  N=Nojo  |  RE=Representação  |  SP=Serv.Ponto',
            fontSize: 7,
            color: '#6B7280',
            margin: [0, 6, 0, 6]
          },
          {
            table: {
              widths: Array(this.tiposAfastamento.length).fill('*'),
              body: summaryBody
            },
            layout: {
              hLineWidth: () => 0.4,
              vLineWidth: () => 0.4,
              hLineColor: () => '#9CA3AF',
              vLineColor: () => '#9CA3AF'
            }
          },
          {
            columns: [
              { text: `Total de afastamentos no ano: ${this.totalFaltas()}`, fontSize: 9, bold: true, margin: [0, 8, 0, 0] },
              { text: '', width: '*' }
            ]
          },
          {
            text: '_______________________________\nAssinatura do Responsável',
            alignment: 'right',
            fontSize: 9,
            margin: [0, 20, 0, 0]
          }
        ],
        styles: {
          title: { fontSize: 13, bold: true, alignment: 'center', margin: [0, 0, 0, 4] },
          subtitle: { fontSize: 9, alignment: 'center', color: '#4B5563', margin: [0, 0, 0, 2] },
          thCell: { bold: true, fontSize: 8, alignment: 'center', fillColor: '#EFF6FF', color: '#1E40AF' }
        }
      };

      const fileName = `ficha100_${this.professorSelecionado.replace(/ /g, '_')}_${this.anoSelecionado}.pdf`;
      (pdfMake as any).default.createPdf(docDefinition).download(fileName);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      this.exibirMensagem('Erro ao gerar PDF. Tente novamente.', 'erro');
    } finally {
      this.exportandoPdf = false;
      this.cdr.markForCheck();
    }
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
