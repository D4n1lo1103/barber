/**
 * Modelli dei messaggi di servizio, in italiano. Ogni modello restituisce
 * oggetto, testo e HTML: il testo è sempre presente, perché alcuni client
 * non mostrano l'HTML e perché resta leggibile nei log in sviluppo.
 */
import type { MessaggioEmail } from './mittente-email.js';

export interface ContestoSalone {
  nomeSalone: string;
  /** Origine pubblica del frontend, es. https://salone.it */
  origineWeb: string;
}

export interface DestinatarioEmail {
  nome: string;
  email: string;
}

function involucro(nomeSalone: string, titolo: string, corpo: string, azione?: string): string {
  return [
    '<!doctype html><html lang="it"><body style="margin:0;background:#f5f5f7;padding:24px;',
    'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1c1e">',
    '<table role="presentation" style="max-width:520px;margin:0 auto;background:#ffffff;',
    'border-radius:16px;padding:32px"><tr><td>',
    `<p style="margin:0 0 4px;font-size:13px;color:#6b6b70">${nomeSalone}</p>`,
    `<h1 style="margin:0 0 16px;font-size:20px">${titolo}</h1>`,
    corpo,
    azione ?? '',
    '<p style="margin:24px 0 0;font-size:12px;color:#6b6b70">',
    'Questo messaggio è stato inviato automaticamente: non occorre rispondere.',
    '</p></td></tr></table></body></html>',
  ].join('');
}

function pulsante(collegamento: string, etichetta: string): string {
  return (
    `<p style="margin:24px 0"><a href="${collegamento}" ` +
    'style="display:inline-block;background:#1c1c1e;color:#ffffff;text-decoration:none;' +
    `padding:12px 20px;border-radius:10px;font-weight:600">${etichetta}</a></p>` +
    `<p style="margin:0;font-size:12px;color:#6b6b70">Se il pulsante non funziona, copia questo indirizzo nel browser:<br>${collegamento}</p>`
  );
}

export function modelloVerificaEmail(
  salone: ContestoSalone,
  destinatario: DestinatarioEmail,
  collegamento: string,
): MessaggioEmail {
  const titolo = 'Conferma il tuo indirizzo e-mail';

  return {
    a: destinatario.email,
    oggetto: `${salone.nomeSalone}: conferma il tuo indirizzo e-mail`,
    testo: [
      `Ciao ${destinatario.nome},`,
      '',
      `per completare la registrazione su ${salone.nomeSalone} conferma il tuo indirizzo e-mail:`,
      collegamento,
      '',
      'Il link resta valido 48 ore. Se non hai richiesto la registrazione, ignora questo messaggio.',
    ].join('\n'),
    html: involucro(
      salone.nomeSalone,
      titolo,
      `<p style="margin:0;font-size:15px;line-height:1.5">Ciao ${destinatario.nome}, conferma il tuo indirizzo e-mail per completare la registrazione e prenotare online. Il link resta valido 48 ore.</p>`,
      pulsante(collegamento, 'Conferma l’indirizzo'),
    ),
  };
}

export function modelloResetPassword(
  salone: ContestoSalone,
  destinatario: DestinatarioEmail,
  collegamento: string,
): MessaggioEmail {
  return {
    a: destinatario.email,
    oggetto: `${salone.nomeSalone}: reimposta la password`,
    testo: [
      `Ciao ${destinatario.nome},`,
      '',
      'hai chiesto di reimpostare la password. Scegline una nuova da qui:',
      collegamento,
      '',
      'Il link resta valido 2 ore e può essere usato una sola volta.',
      'Se non hai fatto questa richiesta, ignora il messaggio: la password attuale resta valida.',
    ].join('\n'),
    html: involucro(
      salone.nomeSalone,
      'Reimposta la password',
      `<p style="margin:0;font-size:15px;line-height:1.5">Ciao ${destinatario.nome}, hai chiesto di reimpostare la password. Il link resta valido 2 ore e può essere usato una sola volta. Se non hai fatto questa richiesta, ignora il messaggio.</p>`,
      pulsante(collegamento, 'Scegli una nuova password'),
    ),
  };
}

export function modelloInvitoAttivazione(
  salone: ContestoSalone,
  destinatario: DestinatarioEmail,
  collegamento: string,
): MessaggioEmail {
  return {
    a: destinatario.email,
    oggetto: `${salone.nomeSalone}: attiva il tuo account`,
    testo: [
      `Ciao ${destinatario.nome},`,
      '',
      `${salone.nomeSalone} ha creato un account per te. Attivalo e scegli la tua password:`,
      collegamento,
      '',
      'Il link resta valido 7 giorni. La password la scegli tu: il salone non la conosce.',
    ].join('\n'),
    html: involucro(
      salone.nomeSalone,
      'Attiva il tuo account',
      `<p style="margin:0;font-size:15px;line-height:1.5">Ciao ${destinatario.nome}, ${salone.nomeSalone} ha creato un account per te. Attivalo e scegli la tua password: il salone non la conosce. Il link resta valido 7 giorni.</p>`,
      pulsante(collegamento, 'Attiva l’account'),
    ),
  };
}

export interface RiepilogoAppuntamento {
  /** Data e ora già formattate nel fuso del salone. */
  quando: string;
  servizi: string;
  operatore: string;
  durata: string;
  totale: string;
}

export function modelloConfermaPrenotazione(
  salone: ContestoSalone,
  destinatario: DestinatarioEmail,
  appuntamento: RiepilogoAppuntamento,
): MessaggioEmail {
  const righe = [
    `Quando: ${appuntamento.quando}`,
    `Servizi: ${appuntamento.servizi}`,
    `Con: ${appuntamento.operatore}`,
    `Durata: ${appuntamento.durata}`,
    `Totale: ${appuntamento.totale}`,
  ];

  return {
    a: destinatario.email,
    oggetto: `${salone.nomeSalone}: appuntamento confermato`,
    testo: [
      `Ciao ${destinatario.nome},`,
      '',
      'il tuo appuntamento è confermato.',
      '',
      ...righe,
      '',
      `Puoi vedere, spostare o annullare l'appuntamento dalla tua area: ${salone.origineWeb}/area-cliente`,
    ].join('\n'),
    html: involucro(
      salone.nomeSalone,
      'Appuntamento confermato',
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Ciao ${destinatario.nome}, il tuo appuntamento è confermato.</p>` +
        '<table role="presentation" style="font-size:15px;line-height:1.6">' +
        righe
          .map((riga) => {
            const [etichetta, ...resto] = riga.split(': ');

            return `<tr><td style="color:#6b6b70;padding-right:12px">${etichetta}</td><td><strong>${resto.join(': ')}</strong></td></tr>`;
          })
          .join('') +
        '</table>',
      pulsante(`${salone.origineWeb}/area-cliente`, 'Vai alla tua area'),
    ),
  };
}

/**
 * Promemoria dell'appuntamento. Parte via e-mail quando WhatsApp non è
 * disponibile: stesso contenuto, canale diverso.
 */
export function modelloPromemoria(
  salone: ContestoSalone,
  destinatario: DestinatarioEmail,
  appuntamento: RiepilogoAppuntamento,
): MessaggioEmail {
  const righe = [
    `Quando: ${appuntamento.quando}`,
    `Servizi: ${appuntamento.servizi}`,
    `Con: ${appuntamento.operatore}`,
    `Durata: ${appuntamento.durata}`,
  ];

  return {
    a: destinatario.email,
    oggetto: `${salone.nomeSalone}: promemoria del tuo appuntamento`,
    testo: [
      `Ciao ${destinatario.nome},`,
      '',
      'ti ricordiamo il tuo prossimo appuntamento.',
      '',
      ...righe,
      '',
      `Per spostarlo o annullarlo: ${salone.origineWeb}/area-cliente`,
    ].join('\n'),
    html: involucro(
      salone.nomeSalone,
      'Promemoria del tuo appuntamento',
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Ciao ${destinatario.nome}, ti ricordiamo il tuo prossimo appuntamento.</p>` +
        '<table role="presentation" style="font-size:15px;line-height:1.6">' +
        righe
          .map((riga) => {
            const [etichetta, ...resto] = riga.split(': ');

            return `<tr><td style="color:#6b6b70;padding-right:12px">${etichetta}</td><td><strong>${resto.join(': ')}</strong></td></tr>`;
          })
          .join('') +
        '</table>',
      pulsante(`${salone.origineWeb}/area-cliente`, 'Vai alla tua area'),
    ),
  };
}
