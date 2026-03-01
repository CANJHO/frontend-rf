import { TestBed } from '@angular/core/testing';

import { ServicioAutenticacion } from './servicio-autenticacion';

describe('ServicioAutenticacion', () => {
  let service: ServicioAutenticacion;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServicioAutenticacion);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
