import { SetMetadata } from '@nestjs/common';

export const CHIAVE_PUBBLICO = 'rotta_pubblica';

/** Marca una rotta come accessibile senza autenticazione. */
export const Pubblico = () => SetMetadata(CHIAVE_PUBBLICO, true);
