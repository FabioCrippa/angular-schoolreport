import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrimeiroAcesso } from './primeiro-acesso';

describe('PrimeiroAcesso', () => {
  let component: PrimeiroAcesso;
  let fixture: ComponentFixture<PrimeiroAcesso>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrimeiroAcesso]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrimeiroAcesso);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
