import type {
  DatiProceduraGuidata,
  Profilo,
  ServizioPredefinito,
  StatoInstallazione,
} from '@barber/shared';
import { chiamaApi } from './client-api';

export interface ConfigurazioneProfiloApi {
  profilo: Profilo;
  etichetta: string;
  granularitaSlotMinuti: number;
  minutiBloccoSlot: number;
  catalogoIniziale: ServizioPredefinito[];
}

export function leggiStatoInstallazione(): Promise<StatoInstallazione> {
  return chiamaApi<StatoInstallazione>('/installazione');
}

export function leggiConfigurazioneProfilo(profilo: Profilo): Promise<ConfigurazioneProfiloApi> {
  return chiamaApi<ConfigurazioneProfiloApi>(`/installazione/profili/${profilo}`);
}

export function completaProceduraGuidata(
  dati: DatiProceduraGuidata,
  chiaveInstallazione: string,
): Promise<void> {
  return chiamaApi<void>('/installazione/procedura-guidata', {
    metodo: 'POST',
    corpo: dati,
    intestazioni: { 'x-chiave-installazione': chiaveInstallazione },
  });
}
