import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistroOcorrencia } from './registro-ocorrencia';

describe('RegistroOcorrencia', () => {
  let component: RegistroOcorrencia;
  let fixture: ComponentFixture<RegistroOcorrencia>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistroOcorrencia]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistroOcorrencia);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
