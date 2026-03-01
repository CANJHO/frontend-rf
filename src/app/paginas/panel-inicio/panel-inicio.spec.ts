import { ComponentFixture, TestBed } from '@angular/core/testing';

import {PanelInicioComponent} from './panel-inicio';

describe('PanelInicio', () => {
  let component: PanelInicioComponent;
  let fixture: ComponentFixture<PanelInicioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PanelInicioComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PanelInicioComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
