import { TestBed } from '@angular/core/testing';

import { ServicioUsuarios } from './servicio-usuarios';

describe('ServicioUsuarios', () => {
  let service: ServicioUsuarios;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServicioUsuarios);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
