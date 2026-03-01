import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KioskoMarcaje } from './kiosko-marcaje';

describe('KioskoMarcaje', () => {
  let component: KioskoMarcaje;
  let fixture: ComponentFixture<KioskoMarcaje>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KioskoMarcaje]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KioskoMarcaje);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
