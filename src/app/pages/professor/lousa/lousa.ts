import {
  Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef,
  ChangeDetectionStrategy, ChangeDetectorRef, inject, HostListener, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

type Tema = 'branca' | 'verde' | 'preta';
type TamanhoFonte = 'normal' | 'grande' | 'enorme';
type ModoEdicao = 'texto' | 'desenho';

const COR_CANETA: Record<Tema, string> = {
  branca: '#1e293b',
  verde:  '#e2ffe8',
  preta:  '#e2e8f0',
};

@Component({
  selector: 'app-lousa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lousa.html',
  styleUrl: './lousa.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Lousa implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('lousaArea')    lousaRef!:  ElementRef<HTMLTextAreaElement>;
  @ViewChild('lousaCanvas')  canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('arquivoInput') arquivoInputRef!: ElementRef<HTMLInputElement>;

  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private cdr       = inject(ChangeDetectorRef);
  private ngZone    = inject(NgZone);
  private sanitizer = inject(DomSanitizer);
  private el        = inject(ElementRef);

  texto        = '';
  tema: Tema              = 'branca';
  tamanhoFonte: TamanhoFonte = 'grande';
  modoEdicao: ModoEdicao  = 'texto';
  emTelaCheia  = false;
  modoProjetor = false;

  // ── Arquivo de fundo ──
  bgTipo: 'imagem' | 'pdf' | null = null;
  bgImagemUrl: string | null = null;
  bgPdfUrl: SafeResourceUrl | null = null;
  private bgObjectUrl: string | null = null;

  private channel     = new BroadcastChannel('lousa-sync');
  private desenhando  = false;
  private ultimoPonto: { x: number; y: number } | null = null;
  private lastMid:     { x: number; y: number } | null = null;

  readonly TEMAS: { valor: Tema; label: string }[] = [
    { valor: 'branca', label: '☀️ Branca' },
    { valor: 'verde',  label: '🟢 Lousa'  },
    { valor: 'preta',  label: '🌙 Escura' },
  ];

  readonly TAMANHOS: { valor: TamanhoFonte; label: string }[] = [
    { valor: 'normal', label: 'A'   },
    { valor: 'grande', label: 'A+'  },
    { valor: 'enorme', label: 'A++' },
  ];

  ngOnInit() {
    this.modoProjetor = !!this.route.snapshot.data['projetor'];
    this.texto = localStorage.getItem('lousa_texto') ?? '';

    this.channel.onmessage = (e) => {
      this.ngZone.run(() => {
        const data = e.data;

        // Projector opened — main window responds with full state
        if (data.tipo === 'solicitarEstado' && !this.modoProjetor) {
          this.channel.postMessage({
            texto:        this.texto,
            tema:         this.tema,
            tamanhoFonte: this.tamanhoFonte,
            canvasData:   this.canvasRef?.nativeElement?.toDataURL() ?? '',
            bgImagem:     this.bgImagemUrl ?? ''
          });
          return;
        }

        if (data.texto       !== undefined) this.texto        = data.texto;
        if (data.tema)                       this.tema         = data.tema as Tema;
        if (data.tamanhoFonte)               this.tamanhoFonte = data.tamanhoFonte as TamanhoFonte;
        if (data.canvasData  !== undefined)  this.loadCanvasData(data.canvasData);
        if (data.bgImagem    !== undefined) {
          this.bgImagemUrl = data.bgImagem || null;
          this.bgTipo      = this.bgImagemUrl ? 'imagem' : null;
        }
        if (data.limpar) {
          this.texto       = '';
          this.clearCanvas();
          this.bgTipo      = null;
          this.bgImagemUrl = null;
          this.bgPdfUrl    = null;
        }

        this.cdr.markForCheck();
      });
    };

    if (this.modoProjetor) {
      this.channel.postMessage({ tipo: 'solicitarEstado' });
      setTimeout(() => document.documentElement.requestFullscreen().catch(() => {}), 600);
    }
  }

  ngAfterViewInit() {
    if (!this.modoProjetor) this.lousaRef?.nativeElement?.focus();
    // Double rAF ensures browser has completed layout before measuring canvas dimensions
    requestAnimationFrame(() => requestAnimationFrame(() => this.resizeCanvas()));

    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    canvas.addEventListener('mousedown',  (e) => this.onCanvasMouseDown(e));
    canvas.addEventListener('mousemove',  (e) => this.onCanvasMouseMove(e));
    canvas.addEventListener('mouseup',    ()  => this.onCanvasMouseUp());
    canvas.addEventListener('mouseleave', ()  => this.onCanvasMouseLeave());
    canvas.addEventListener('touchstart', (e) => this.onCanvasTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove',  (e) => this.onCanvasTouchMove(e),  { passive: false });
    canvas.addEventListener('touchend',   (e) => this.onCanvasTouchEnd(e),   { passive: false });
  }

  ngOnDestroy() {
    this.channel.close();
    if (this.bgObjectUrl) URL.revokeObjectURL(this.bgObjectUrl);
  }

  @HostListener('window:resize')
  onWindowResize() { this.resizeCanvas(); }

  private resizeCanvas() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (!w || !h) return; // guard: skip if layout not ready
    const saved = canvas.width > 0 && canvas.height > 0 ? canvas.toDataURL() : null;
    canvas.width  = w;
    canvas.height = h;
    if (saved) this.loadCanvasData(saved);
  }

  private get ctx(): CanvasRenderingContext2D | null {
    return this.canvasRef?.nativeElement?.getContext('2d') ?? null;
  }

  // ── Texto ──────────────────────────────────────────────────────────────

  onTextoChange() {
    localStorage.setItem('lousa_texto', this.texto);
    if (!this.modoProjetor) this.channel.postMessage({ texto: this.texto });
  }

  onTemaChange(tema: Tema) {
    this.tema = tema;
    if (!this.modoProjetor) this.channel.postMessage({ tema });
  }

  onTamanhoChange(tamanho: TamanhoFonte) {
    this.tamanhoFonte = tamanho;
    if (!this.modoProjetor) this.channel.postMessage({ tamanhoFonte: tamanho });
  }

  toggleModoEdicao() {
    this.modoEdicao = this.modoEdicao === 'texto' ? 'desenho' : 'texto';
    if (this.modoEdicao === 'texto') {
      setTimeout(() => this.lousaRef?.nativeElement?.focus(), 50);
    } else {
      // Re-measure canvas when entering drawing mode to ensure correct dimensions
      requestAnimationFrame(() => requestAnimationFrame(() => this.resizeCanvas()));
    }
    this.cdr.markForCheck();
  }

  // ── Desenho ────────────────────────────────────────────────────────────

  private getCanvasPos(event: MouseEvent | Touch): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width  / rect.width),
      y: (event.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  private drawLine(from: { x: number; y: number }, to: { x: number; y: number }) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = COR_CANETA[this.tema];
    ctx.lineWidth   = 4;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.stroke();
  }

  // Smooth drawing using quadratic bezier (midpoint technique)
  private drawSmooth(to: { x: number; y: number }) {
    const ctx = this.ctx;
    if (!ctx || !this.ultimoPonto) return;
    const mid = {
      x: (this.ultimoPonto.x + to.x) / 2,
      y: (this.ultimoPonto.y + to.y) / 2,
    };
    ctx.beginPath();
    ctx.moveTo(
      this.lastMid?.x ?? this.ultimoPonto.x,
      this.lastMid?.y ?? this.ultimoPonto.y
    );
    ctx.quadraticCurveTo(this.ultimoPonto.x, this.ultimoPonto.y, mid.x, mid.y);
    ctx.strokeStyle = COR_CANETA[this.tema];
    ctx.lineWidth   = 4;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.stroke();
    this.lastMid     = mid;
    this.ultimoPonto = to;
  }

  private clearCanvas() {
    const ctx = this.ctx;
    const canvas = this.canvasRef?.nativeElement;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private loadCanvasData(dataUrl: string) {
    if (!dataUrl) return;
    const canvas = this.canvasRef?.nativeElement;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
  }

  private syncCanvas() {
    const dataUrl = this.canvasRef?.nativeElement?.toDataURL() ?? '';
    this.channel.postMessage({ canvasData: dataUrl });
  }

  onCanvasMouseDown(e: MouseEvent) {
    if (this.modoEdicao !== 'desenho') return;
    e.preventDefault();
    this.desenhando  = true;
    this.lastMid     = null;
    const p = this.getCanvasPos(e);
    this.ultimoPonto = p;
    // Draw a dot for single clicks
    const ctx = this.ctx;
    if (ctx) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = COR_CANETA[this.tema];
      ctx.fill();
    }
  }

  onCanvasMouseMove(e: MouseEvent) {
    if (!this.desenhando || !this.ultimoPonto) return;
    this.drawSmooth(this.getCanvasPos(e));
  }

  onCanvasMouseUp() {
    if (!this.desenhando) return;
    this.desenhando  = false;
    this.ultimoPonto = null;
    this.lastMid     = null;
    this.syncCanvas();
  }

  onCanvasMouseLeave() {
    if (this.desenhando) {
      this.desenhando  = false;
      this.ultimoPonto = null;
      this.lastMid     = null;
      this.syncCanvas();
    }
  }

  onCanvasTouchStart(e: TouchEvent) {
    e.preventDefault();
    if (!e.touches.length) return;
    this.desenhando  = true;
    this.lastMid     = null;
    const p = this.getCanvasPos(e.touches[0]);
    this.ultimoPonto = p;
    const ctx = this.ctx;
    if (ctx) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = COR_CANETA[this.tema];
      ctx.fill();
    }
  }

  onCanvasTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (!this.desenhando || !this.ultimoPonto || !e.touches.length) return;
    this.drawSmooth(this.getCanvasPos(e.touches[0]));
  }

  onCanvasTouchEnd(e: TouchEvent) {
    e.preventDefault();
    this.desenhando  = false;
    this.ultimoPonto = null;
    this.lastMid     = null;
    this.syncCanvas();
  }

  // ── Ações gerais ────────────────────────────────────────────────────────

  limpar() {
    const temConteudo = this.texto.trim() || this.hasDrawing() || !!this.bgTipo;
    if (temConteudo && !confirm('Limpar a lousa?')) return;
    this.texto = '';
    localStorage.removeItem('lousa_texto');
    this.clearCanvas();
    if (this.bgTipo) this.removerFundo();
    this.channel.postMessage({ limpar: true });
    if (this.modoEdicao === 'texto') setTimeout(() => this.lousaRef?.nativeElement?.focus(), 50);
    this.cdr.markForCheck();
  }

  private hasDrawing(): boolean {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !canvas.width) return false;
    const data = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!data) return false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return true;
    }
    return false;
  }

  async toggleTelaCheia() {
    try {
      if (!document.fullscreenElement) {
        await (this.el.nativeElement as HTMLElement).requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch { /* sem suporte */ }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    this.emTelaCheia = !!document.fullscreenElement;
    this.cdr.markForCheck();
  }

  projetarNovaJanela() {
    window.open('/projetar', '_blank');
  }

  // ── Arquivo de fundo ──────────────────────────────────────────────────────

  onAbrirArquivo() {
    this.arquivoInputRef?.nativeElement?.click();
  }

  onArquivoSelecionado(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    input.value = ''; // permite recarregar o mesmo ficheiro

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        if (this.bgObjectUrl) { URL.revokeObjectURL(this.bgObjectUrl); this.bgObjectUrl = null; }
        this.bgTipo      = 'imagem';
        this.bgImagemUrl = reader.result as string;
        this.bgPdfUrl    = null;
        if (this.modoEdicao === 'texto') this.toggleModoEdicao();
        if (!this.modoProjetor) this.channel.postMessage({ bgImagem: this.bgImagemUrl });
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      if (this.bgObjectUrl) URL.revokeObjectURL(this.bgObjectUrl);
      this.bgObjectUrl = URL.createObjectURL(file);
      this.bgTipo      = 'pdf';
      this.bgImagemUrl = null;
      this.bgPdfUrl    = this.sanitizer.bypassSecurityTrustResourceUrl(this.bgObjectUrl);
      if (this.modoEdicao === 'texto') this.toggleModoEdicao();
      this.cdr.markForCheck();
    }
  }

  removerFundo() {
    this.bgTipo      = null;
    this.bgImagemUrl = null;
    this.bgPdfUrl    = null;
    if (this.bgObjectUrl) { URL.revokeObjectURL(this.bgObjectUrl); this.bgObjectUrl = null; }
    if (!this.modoProjetor) this.channel.postMessage({ bgImagem: '' });
    this.cdr.markForCheck();
  }

  irParaDiario() {
    this.router.navigate(['/professor/diario']);
  }
}

