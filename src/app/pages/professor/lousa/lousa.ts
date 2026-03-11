import {
  Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef,
  ChangeDetectionStrategy, ChangeDetectorRef, inject, HostListener, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

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

  @ViewChild('lousaArea')   lousaRef!:  ElementRef<HTMLTextAreaElement>;
  @ViewChild('lousaCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private router  = inject(Router);
  private route   = inject(ActivatedRoute);
  private cdr     = inject(ChangeDetectorRef);
  private ngZone  = inject(NgZone);

  texto        = '';
  tema: Tema              = 'branca';
  tamanhoFonte: TamanhoFonte = 'grande';
  modoEdicao: ModoEdicao  = 'texto';
  emTelaCheia  = false;
  modoProjetor = false;

  private channel     = new BroadcastChannel('lousa-sync');
  private desenhando  = false;
  private ultimoPonto: { x: number; y: number } | null = null;

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
            texto:       this.texto,
            tema:        this.tema,
            tamanhoFonte: this.tamanhoFonte,
            canvasData:  this.canvasRef?.nativeElement?.toDataURL() ?? ''
          });
          return;
        }

        if (data.texto       !== undefined) this.texto       = data.texto;
        if (data.tema)                       this.tema        = data.tema as Tema;
        if (data.tamanhoFonte)               this.tamanhoFonte = data.tamanhoFonte as TamanhoFonte;
        if (data.canvasData  !== undefined)  this.loadCanvasData(data.canvasData);
        if (data.limpar) {
          this.texto = '';
          this.clearCanvas();
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
    setTimeout(() => this.resizeCanvas(), 0);

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
  }

  @HostListener('window:resize')
  onWindowResize() { this.resizeCanvas(); }

  private resizeCanvas() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const saved = canvas.width > 0 && canvas.height > 0 ? canvas.toDataURL() : null;
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
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
    this.desenhando  = true;
    this.ultimoPonto = this.getCanvasPos(e);
  }

  onCanvasMouseMove(e: MouseEvent) {
    if (!this.desenhando || !this.ultimoPonto) return;
    const p = this.getCanvasPos(e);
    this.drawLine(this.ultimoPonto, p);
    this.ultimoPonto = p;
  }

  onCanvasMouseUp() {
    if (!this.desenhando) return;
    this.desenhando = false;
    this.ultimoPonto = null;
    this.syncCanvas();
  }

  onCanvasMouseLeave() {
    if (this.desenhando) {
      this.desenhando = false;
      this.ultimoPonto = null;
      this.syncCanvas();
    }
  }

  onCanvasTouchStart(e: TouchEvent) {
    e.preventDefault();
    if (!e.touches.length) return;
    this.desenhando  = true;
    this.ultimoPonto = this.getCanvasPos(e.touches[0]);
  }

  onCanvasTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (!this.desenhando || !this.ultimoPonto || !e.touches.length) return;
    const p = this.getCanvasPos(e.touches[0]);
    this.drawLine(this.ultimoPonto, p);
    this.ultimoPonto = p;
  }

  onCanvasTouchEnd(e: TouchEvent) {
    e.preventDefault();
    this.desenhando = false;
    this.ultimoPonto = null;
    this.syncCanvas();
  }

  // ── Ações gerais ────────────────────────────────────────────────────────

  limpar() {
    const temConteudo = this.texto.trim() || this.hasDrawing();
    if (temConteudo && !confirm('Limpar a lousa?')) return;
    this.texto = '';
    localStorage.removeItem('lousa_texto');
    this.clearCanvas();
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
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
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

  irParaDiario() {
    this.router.navigate(['/professor/diario']);
  }
}

