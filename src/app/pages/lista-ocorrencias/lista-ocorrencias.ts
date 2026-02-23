import { Component, inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FirestoreService, Ocorrencia } from '../../services/firestore';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-lista-ocorrencias',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './lista-ocorrencias.html',
  styleUrl: './lista-ocorrencias.scss',
})
export class ListaOcorrencias implements OnInit {
  
  private router = inject(Router);
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  
  ocorrencias: Ocorrencia[] = [];
  ocorrenciasFiltradas: Ocorrencia[] = [];
  loading = true;
  isAdmin = false;
  userRole: 'professor' | 'coordenacao' | 'direcao' | 'secretaria' | null = null;
  userName: string | null = null;
  
  // Filtros
  filtroAluno = '';
  filtroProfessor = '';
  professoresUnicos: string[] = [];

  private ADMIN_EMAILS = ['professor@escola.com'];
  
  ngOnInit() {
    // Verifica se o usuário é admin
    const user = this.authService.getCurrentUser();
    if (user) {
      this.isAdmin = this.ADMIN_EMAILS.includes(user.email || '');
      this.userName = user.displayName || user.email || null;
    }
    
    this.carregarDadosUsuario();
  }
  
  async carregarDadosUsuario() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;
      
      // Buscar dados do usuário no Firestore para pegar o role
      const usuario = await this.firestoreService.buscarUsuario(user.uid);
      if (usuario) {
        this.userRole = usuario.role;
        console.log('Role do usuário:', this.userRole);
      }
      
      // Carrega ocorrências após saber o role
      await this.carregarOcorrencias();
      
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
      await this.carregarOcorrencias(); // Tenta carregar mesmo com erro
    }
  }
  
  async carregarOcorrencias() {
    try {
      this.loading = true;
      
      // Buscar escolaId do usuário logado
      const escolaId = await this.authService.getEscolaId();
      
      if (!escolaId) {
        alert('Erro: Usuário não vinculado a nenhuma escola. Contate o administrador.');
        this.loading = false;
        return;
      }
      
      // Busca todas as ocorrências da escola
      const todasOcorrencias = await this.firestoreService.buscarOcorrencias(escolaId);
      
      // Ordena por data: mais recentes primeiro
      todasOcorrencias.sort((a, b) => {
        const dataA = new Date(a.data).getTime();
        const dataB = new Date(b.data).getTime();
        return dataB - dataA; // Ordem decrescente (mais nova para mais velha)
      });
      
      // Se for professor, filtra apenas suas ocorrências
      // Se for coordenação ou direção, mostra todas
      if (this.userRole === 'professor') {
        const user = this.authService.getCurrentUser();
        this.ocorrencias = todasOcorrencias.filter(
          occ => occ.professorEmail === user?.email
        );
        console.log('Ocorrências do professor carregadas:', this.ocorrencias.length);
      } else {
        this.ocorrencias = todasOcorrencias;
        
        // Extrai lista única de professores para o filtro
        const professoresSet = new Set<string>();
        this.ocorrencias.forEach(occ => {
          if (occ.professorNome) {
            professoresSet.add(occ.professorNome);
          }
        });
        this.professoresUnicos = Array.from(professoresSet).sort();
        
        console.log('Todas as ocorrências da escola carregadas:', this.ocorrencias.length);
        console.log('Professores únicos:', this.professoresUnicos);
      }
      
      // Inicializa lista filtrada
      this.aplicarFiltros();
      
      console.log('Dados:', this.ocorrencias);
      
    } catch (error) {
      console.error('Erro ao carregar ocorrências:', error);
      alert('Erro ao carregar ocorrências');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
      console.log('Loading após finally:', this.loading);
    }
  }
  
  voltar() {
    this.router.navigate(['/dashboard']);
  }
  
  toggleExpansao(ocorrencia: Ocorrencia) {
    ocorrencia.expandido = !ocorrencia.expandido;
  }
  
  aplicarFiltros() {
    this.ocorrenciasFiltradas = this.ocorrencias.filter(occ => {
      // Filtro por aluno
      const matchAluno = !this.filtroAluno || 
        occ.nomeAluno.toLowerCase().includes(this.filtroAluno.toLowerCase());
      
      // Filtro por professor
      const matchProfessor = !this.filtroProfessor || 
        occ.professorNome === this.filtroProfessor;
      
      return matchAluno && matchProfessor;
    });
    
    console.log('Filtros aplicados:', {
      aluno: this.filtroAluno,
      professor: this.filtroProfessor,
      resultados: this.ocorrenciasFiltradas.length
    });
  }
  
  limparFiltros() {
    this.filtroAluno = '';
    this.filtroProfessor = '';
    this.aplicarFiltros();
  }
  
  async gerarPDF(ocorrencia: Ocorrencia) {
    try {
      // Importar pdfMake dinamicamente (evita problemas com SSR)
      const pdfMake = await import('pdfmake/build/pdfmake');
      const pdfFonts = await import('pdfmake/build/vfs_fonts');
      
      // Configurar pdfMake com fontes
      (pdfMake as any).default.vfs = (pdfFonts as any).default;
      
      // Buscar dados da escola
      const escola = await this.firestoreService.buscarEscola(ocorrencia.escolaId);
      
      if (!escola) {
        alert('Erro ao buscar dados da escola');
        return;
      }
      
      // Converter data para formato local (evita problema de timezone)
      const partes = ocorrencia.data.split('-');
      const dataOcorrencia = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
      const dataFormatada = dataOcorrencia.toLocaleDateString('pt-BR');
      
      // Definir cor da gravidade
      const gravidadeCor: { [key: string]: string } = {
        'Leve': '#10b981',
        'Moderada': '#f59e0b',
        'Grave': '#ef4444',
        'Gravíssima': '#991b1b'
      };
      const corGravidade = gravidadeCor[ocorrencia.gravidade] || '#6b7280';
      
      // Gerar código único da ocorrência (primeiros 8 caracteres do ID)
      const codigoOcorrencia = ocorrencia.id?.substring(0, 8).toUpperCase() || 'N/A';
      
      // Definir o documento PDF
      const documentDefinition: any = {
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 100],
        
        header: {
          margin: [40, 20, 40, 0],
          columns: [
            {
              text: escola.nome || 'Escola',
              style: 'header',
              alignment: 'left'
            },
            {
              text: `Código: ${codigoOcorrencia}`,
              style: 'headerRight',
              alignment: 'right'
            }
          ]
        },
        
        footer: (currentPage: number, pageCount: number) => {
          return {
            margin: [40, 0, 40, 20],
            stack: [
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e5e7eb' }] },
              { text: '\n' },
              {
                columns: [
                  {
                    width: '60%',
                    stack: [
                      { text: 'CIÊNCIA DO RESPONSÁVEL', style: 'assinaturaLabel' },
                      { text: '\n' },
                      { text: 'Assinatura: _________________________________________', style: 'assinaturaLinha' },
                      { text: '\n' },
                      { text: 'Data da ciência: ______ / ______ / __________', style: 'assinaturaLinha' }
                    ]
                  },
                  {
                    width: '40%',
                    text: [
                      { text: 'Documento gerado eletronicamente\n', style: 'footerInfo' },
                      { text: `Página ${currentPage} de ${pageCount}`, style: 'footerInfo' }
                    ],
                    alignment: 'right'
                  }
                ]
              }
            ]
          };
        },
        
        content: [
          { text: 'RELATÓRIO DE OCORRÊNCIA ESCOLAR', style: 'titulo' },
          { text: '\n' },
          
          // Info da escola
          {
            table: {
              widths: ['*'],
              body: [
                [{ text: 'DADOS DA INSTITUIÇÃO', style: 'secaoTitulo', fillColor: '#f3f4f6' }],
                [
                  {
                    stack: [
                      { text: `Escola: ${escola.nome}`, style: 'infoTexto' },
                      { text: `Data do registro: ${dataFormatada}`, style: 'infoTexto' }
                    ],
                    margin: [10, 5, 10, 5]
                  }
                ]
              ]
            },
            layout: 'lightHorizontalLines'
          },
          
          { text: '\n' },
          
          // Dados do aluno
          {
            table: {
              widths: ['*'],
              body: [
                [{ text: 'DADOS DO ALUNO', style: 'secaoTitulo', fillColor: '#f3f4f6' }],
                [
                  {
                    stack: [
                      { text: `Nome: ${ocorrencia.nomeAluno}`, style: 'infoTexto' },
                      { text: `Turma: ${ocorrencia.turma}`, style: 'infoTexto' },
                      { text: `Tipo de Ensino: ${ocorrencia.tipoEnsino}`, style: 'infoTexto' }
                    ],
                    margin: [10, 5, 10, 5]
                  }
                ]
              ]
            },
            layout: 'lightHorizontalLines'
          },
          
          { text: '\n' },
          
          // Detalhes da ocorrência
          {
            table: {
              widths: ['*'],
              body: [
                [{ text: 'DETALHES DA OCORRÊNCIA', style: 'secaoTitulo', fillColor: '#f3f4f6' }],
                [
                  {
                    stack: [
                      { text: `Tipo: ${ocorrencia.tipoOcorrencia}`, style: 'infoTexto' },
                      { text: `Disciplina: ${ocorrencia.disciplina}`, style: 'infoTexto' },
                      { text: '\n' },
                      { text: 'Descrição:', style: 'infoLabel' },
                      { text: ocorrencia.descricao, style: 'descricao' }
                    ],
                    margin: [10, 5, 10, 5]
                  }
                ]
              ]
            },
            layout: 'lightHorizontalLines'
          },
          
          { text: '\n' },
          
          // Professor responsável
          {
            table: {
              widths: ['*'],
              body: [
                [{ text: 'REGISTRADO POR', style: 'secaoTitulo', fillColor: '#f3f4f6' }],
                [
                  {
                    stack: [
                      { text: `Professor(a): ${ocorrencia.professorNome}`, style: 'infoTexto' }
                    ],
                    margin: [10, 5, 10, 5]
                  }
                ]
              ]
            },
            layout: 'lightHorizontalLines'
          }
        ],
        
        styles: {
          header: {
            fontSize: 16,
            bold: true,
            color: '#1f2937'
          },
          headerRight: {
            fontSize: 10,
            color: '#6b7280'
          },
          titulo: {
            fontSize: 18,
            bold: true,
            alignment: 'center',
            color: '#1f2937',
            margin: [0, 0, 0, 10]
          },
          secaoTitulo: {
            fontSize: 12,
            bold: true,
            color: '#1f2937',
            margin: [5, 5, 5, 5]
          },
          infoLabel: {
            fontSize: 10,
            bold: true,
            color: '#374151',
            margin: [0, 5, 0, 2]
          },
          infoTexto: {
            fontSize: 10,
            color: '#4b5563',
            margin: [0, 2, 0, 2]
          },
          descricao: {
            fontSize: 10,
            color: '#4b5563',
            margin: [0, 5, 0, 5],
            italics: true
          },
          assinaturaLabel: {
            fontSize: 10,
            bold: true,
            color: '#374151'
          },
          assinaturaLinha: {
            fontSize: 9,
            color: '#6b7280'
          },
          footerInfo: {
            fontSize: 8,
            color: '#9ca3af',
            italics: true
          }
        }
      };
      
      // Gerar e baixar o PDF
      const nomeArquivo = `Ocorrencia_${ocorrencia.nomeAluno.replace(/\s+/g, '_')}_${codigoOcorrencia}.pdf`;
      (pdfMake as any).default.createPdf(documentDefinition).download(nomeArquivo);
      
    } catch (erro) {
      console.error('Erro ao gerar PDF:', erro);
      alert('Erro ao gerar PDF. Tente novamente.');
    }
  }
}
