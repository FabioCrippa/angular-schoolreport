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

  // grade[mesIndex][diaIndex] = tipoAfastamento code or ''
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
          this.editandoDados = false;
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
    // grade[mesIndex][diaIndex] — linhas = meses, colunas = dias
    this.grade = Array.from({ length: 12 }, () => Array(31).fill(''));
    for (const falta of this.faltas) {
      const parts = falta.data.split('-');
      if (parts.length !== 3) continue;
      const mes = parseInt(parts[1], 10) - 1;
      const dia = parseInt(parts[2], 10) - 1;
      if (dia >= 0 && dia < 31 && mes >= 0 && mes < 12) {
        this.grade[mes][dia] = falta.tipoAfastamento || 'F';
      }
    }
  }

  async salvarDadosFuncionais() { /* kept for TS compatibility, not used in template */ }

  irParaCadastro() {
    this.router.navigate(['/secretaria/gerenciar-professores']);
  }

  contarPorTipo(sigla: string): number {
    return this.faltas.filter(f => (f.tipoAfastamento || 'F') === sigla).length;
  }

  totalFaltas(): number {
    return this.faltas.length;
  }

  contarPorMes(mesIndex: number): number {
    // grade[mesIndex] is a row of 31 days
    return (this.grade[mesIndex] || []).filter(v => v !== '').length;
  }

  totalAno(): number {
    return this.grade.reduce((sum, row) => sum + row.filter(v => v !== '').length, 0);
  }

  async exportarPDF() {
    if (!this.fichaCarregada) return;

    try {
      this.exportandoPdf = true;
      this.cdr.markForCheck();

      const pdfMake = await import('pdfmake/build/pdfmake');
      const pdfFonts = await import('pdfmake/build/vfs_fonts');
      (pdfMake as any).default.vfs = (pdfFonts as any).default;

      // Fetch logo as base64 for pdfmake
      let logoBase64: string | null = null;
      try {
        const resp = await fetch('/logo-secretaria-educacao-sp.png');
        const blob = await resp.blob();
        logoBase64 = await new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch { /* logo optional */ }

      const d = this.dadosFuncionais;
      const nomeProf = d?.nomeCompleto || this.professorSelecionado;

      // Helper: one info row as a single-row borderless table with bottom-border cells
      const infoLinha = (fields: { label: string; value: string | undefined }[]) => ({
        table: {
          widths: fields.map(() => '*'),
          body: [[
            ...fields.map(f => ({
              stack: [
                { text: f.label, fontSize: 6.5, color: '#64748B' },
                { text: f.value || '—', fontSize: 8.5 }
              ],
              border: [false, false, false, true],
              borderColor: [null, null, null, '#CBD5E1'],
              margin: [2, 0, 2, 2]
            }))
          ]]
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === node.table.body.length) ? 0.3 : 0,
          vLineWidth: () => 0,
          hLineColor: () => '#CBD5E1'
        },
        margin: [0, 0, 0, 3]
      });

      // Frequency table — rows = meses, cols = dias 1-31 + total
      const freqHeader: any[] = [
        { text: 'MÊS', style: 'th', fillColor: '#E2E8F0' },
        ...this.dias.map(n => ({ text: String(n), style: 'th', fillColor: '#E2E8F0' })),
        { text: 'TOTAL', style: 'th', fillColor: '#E2E8F0' }
      ];

      const freqRows: any[][] = this.mesesAbrev.map((mes, mi) => {
        const row: any[] = [{ text: mes, style: 'th', fillColor: '#F1F5F9' }];
        for (let di = 0; di < 31; di++) {
          const val = this.grade[mi]?.[di] || '';
          row.push({
            text: val,
            alignment: 'center',
            fontSize: 7,
            bold: !!val,
            fillColor: val ? '#DBEAFE' : null,
            color: val ? '#1E40AF' : '#000000'
          });
        }
        const total = this.contarPorMes(mi);
        row.push({ text: total > 0 ? String(total) : '', style: 'th', fillColor: '#F1F5F9' });
        return row;
      });

      const legendaTexto = this.tiposAfastamento.map(t => `${t.sigla} = ${t.desc}`).join('   |   ');

      const docDefinition: any = {
        pageOrientation: 'landscape',
        pageMargins: [20, 20, 20, 20],
        content: [
          // Cabeçalho: [logo + descrição | título centrado | espaço espelho]
          {
            columns: [
              // Coluna esquerda: logo + nome da secretaria
              {
                stack: [
                  ...(logoBase64 ? [{ image: logoBase64, width: 72, margin: [0, 0, 0, 4] }] : []),
                  { text: 'Secretaria da Educação', fontSize: 7.5, bold: true, color: '#1e3a5f' },
                  { text: 'do Estado de São Paulo', fontSize: 7.5, color: '#1e3a5f' }
                ],
                width: 120
              },
              // Coluna central: título da ficha
              {
                stack: [
                  { text: 'FICHA DE FREQUÊNCIA DO PROFESSOR (FICHA 100)', style: 'title' },
                  { text: `${this.escolaNome ? this.escolaNome + '   —   ' : ''}Ano Letivo: ${this.anoSelecionado}`, style: 'subtitle' }
                ],
                alignment: 'center',
                width: '*'
              },
              // Coluna direita: espelho para equilíbrio visual
              { text: '', width: 120 }
            ],
            margin: [0, 0, 0, 4]
          },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 800, y2: 0, lineWidth: 1, lineColor: '#64748B' }], margin: [0, 2, 0, 5] },

          // Linha 1 — Dados pessoais
          infoLinha([
            { label: 'Nome completo', value: nomeProf },
            { label: 'Data de nascimento', value: d?.dataNascimento },
            { label: 'Sexo', value: d?.sexo },
            { label: 'Matrícula', value: d?.matricula },
            { label: 'RG', value: d?.rg },
            { label: 'CPF', value: d?.cpf }
          ]),

          // Linha 2 — Dados do cargo
          infoLinha([
            { label: 'Cargo / Função', value: d?.cargo },
            { label: 'Categoria', value: d?.categoria },
            { label: 'Órgão de Classificação', value: d?.orgaoClassificacao },
            { label: 'Município', value: d?.municipio },
            { label: 'Lotação', value: d?.lotacao },
            { label: 'PIS / PASEP', value: d?.pisPasep }
          ]),

          // Linha 3 — Horários
          infoLinha([
            { label: 'Horário de Trabalho', value: d?.horarioTrabalho },
            { label: 'Horário de Estudante', value: d?.horarioEstudante },
            { label: 'Local da Função', value: d?.localFuncao }
          ]),

          // Linha 4 — Início e acúmulo
          infoLinha([
            { label: 'Início no Cargo', value: d?.inicioNoCargo },
            { label: 'Início no Serviço Público', value: d?.inicioServicoPublico },
            { label: 'Acumula Cargo (S/N)', value: d?.acumulaCargo }
          ]),

          // Tabela de frequência
          {
            table: {
              headerRows: 1,
              widths: [28, ...Array(31).fill(21), 28],
              body: [freqHeader, ...freqRows]
            },
            layout: {
              hLineWidth: () => 0.4,
              vLineWidth: () => 0.4,
              hLineColor: () => '#94A3B8',
              vLineColor: () => '#94A3B8',
              paddingLeft: () => 1,
              paddingRight: () => 1,
              paddingTop: () => 1,
              paddingBottom: () => 1
            },
            margin: [0, 5, 0, 5]
          },

          // Legenda
          {
            text: [{ text: 'LEGENDA:  ', bold: true, fontSize: 7 }, { text: legendaTexto, fontSize: 7 }],
            color: '#374151',
            margin: [0, 0, 0, 5]
          },

          // Observações
          {
            table: {
              widths: ['*'],
              body: [[{
                stack: [
                  { text: 'Observações:', fontSize: 7, bold: true, color: '#64748B', margin: [0, 0, 0, 2] },
                  { text: d?.observacoes || ' ', fontSize: 8.5 }
                ],
                border: [false, false, false, true],
                borderColor: [null, null, null, '#CBD5E1'],
                margin: [2, 2, 2, 4]
              }]]
            },
            layout: { hLineWidth: () => 0.4, vLineWidth: () => 0, hLineColor: () => '#CBD5E1' },
            margin: [0, 0, 0, 18]
          },

          // Assinaturas
          {
            columns: [
              {
                stack: [
                  { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 0.8, lineColor: '#374151' }] },
                  { text: 'Responsável pelo preenchimento', fontSize: 8, alignment: 'center', margin: [0, 2, 0, 0] },
                  { text: 'Data: ____/____/________', fontSize: 8, alignment: 'center', color: '#6B7280' }
                ],
                width: 230
              },
              { text: '', width: '*' },
              {
                stack: [
                  { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 0.8, lineColor: '#374151' }] },
                  { text: 'Diretor(a) / Dirigente', fontSize: 8, alignment: 'center', margin: [0, 2, 0, 0] },
                  { text: 'Data: ____/____/________', fontSize: 8, alignment: 'center', color: '#6B7280' }
                ],
                width: 230
              }
            ]
          }
        ],
        styles: {
          title: { fontSize: 12, bold: true, alignment: 'center', margin: [0, 0, 0, 2] },
          subtitle: { fontSize: 8.5, alignment: 'center', color: '#475569', margin: [0, 0, 0, 2] },
          th: { bold: true, fontSize: 7, alignment: 'center', color: '#1E293B' }
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
