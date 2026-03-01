import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { guardianAutenticacionGuard } from './guardian-autenticacion-guard';

describe('guardianAutenticacionGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => guardianAutenticacionGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
