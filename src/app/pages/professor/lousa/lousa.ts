import {
  Component, OnInit, AfterViewInit, ViewChild, ElementRef,
  ChangeDetectionStrategy, ChangeDetectorRef, inject, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

type Tema = 'branca' | 'verde' | 'preta';
type TamanhoFonte = 'normal' | 'grande' | 'enorme';

@Component({
  selector: 'app-lousa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lousa.html',
  styleUrl: './lousa.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Lousa implements OnInit, AfterViewInit {

  @ViewChild('lousaArea') lousaRef!: ElementRef<HTMLTextAreaElement>;

  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  texto = '';
  tema: Tema = 'branca';
  tamanhoFonte: TamanhoFonte = 'grande';
  emTelaCheia = false;

  readonly TEMAS: { valor: Tema; label: string; fundo: string }[] = [
    { valor: 'branca', label: '☀️ Branca',   fundo: '#ffffff' },
    { valor: 'verde',  label: '🟢 Lousa',    fundo: '#1a4731' },
    { valor: 'preta',  label: '🌙 Escura',   fundo: '#0f172a' },
  ];

  readonly TAMANHOS: { valor: TamanhoFonte; label: string }[] = [
    { valor: 'normal', label: 'A'   },
    { valor: 'grande', label: 'A+'  },
    { valor: 'enorme', label: 'A++' },
  ];

  ngOnInit() {
    this.texto = localStorage.getItem('lousa_texto') ?? '';
  }

  ngAfterViewInit() {
    this.lousaRef?.nativeElement?.focus();
  }

  onTextoChange() {
    localStorage.setItem('lousa_texto', this.texto);
  }

  limpar() {
    if (this.texto && !confirm('Limpar a lousa?')) return;
    this.texto = '';
    localStorage.removeItem('lousa_texto');
    this.lousaRef?.nativeElement?.focus();
    this.cdr.markForCheck();
  }

  async toggleTelaCheia() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch { /* navegador sem suporte */ }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    this.emTelaCheia = !!document.fullscreenElement;
    this.cdr.markForCheck();
  }

  projetarNovaJanela() {
    window.open('/professor/lousa', '_blank');
  }

  irParaDiario() {
    this.router.navigate(['/professor/diario']);
  }
}
