import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListaOcorrencias } from './lista-ocorrencias';

describe('ListaOcorrencias', () => {
  let component: ListaOcorrencias;
  let fixture: ComponentFixture<ListaOcorrencias>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaOcorrencias]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListaOcorrencias);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
