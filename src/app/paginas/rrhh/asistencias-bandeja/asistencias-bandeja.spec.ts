import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AsistenciasBandeja } from './asistencias-bandeja';

describe('AsistenciasBandeja', () => {
  let component: AsistenciasBandeja;
  let fixture: ComponentFixture<AsistenciasBandeja>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsistenciasBandeja]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AsistenciasBandeja);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
