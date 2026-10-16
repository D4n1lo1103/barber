import { SetMetadata } from '@nestjs/common';
import type { Ruolo } from '@barber/shared';

export const CHIAVE_RUOLI = 'ruoli_consentiti';

/** Limita l'accesso alla rotta ai soli ruoli indicati. */
export const Ruoli = (...ruoli: Ruolo[]) => SetMetadata(CHIAVE_RUOLI, ruoli);
