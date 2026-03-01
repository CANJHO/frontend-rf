import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PanelPrincipalComponent } from './panel-principal';

describe('PanelPrincipal', () => {
  let component: PanelPrincipalComponent;
  let fixture: ComponentFixture<PanelPrincipalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PanelPrincipalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PanelPrincipalComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
