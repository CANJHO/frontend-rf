import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AsistenciasDia } from './asistencias-dia';

describe('AsistenciasDia', () => {
  let component: AsistenciasDia;
  let fixture: ComponentFixture<AsistenciasDia>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsistenciasDia]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AsistenciasDia);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
