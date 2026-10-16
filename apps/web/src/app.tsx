import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { FornitoreSessione } from './autenticazione/contesto-sessione';
import { Avviso } from './componenti/avviso';
import { Caricamento } from './componenti/caricamento';
import { RottaProtetta } from './componenti/rotta-protetta';
import { FornitoreInstallazione, usaInstallazione } from './installazione/contesto-installazione';
import { PaginaAccesso } from './pagine/accesso';
import { PaginaAttivazione } from './pagine/attivazione';
import { PaginaImpostazioni } from './pagine/impostazioni/impostazioni';
import { PaginaPannello } from './pagine/pannello';
import { PaginaProceduraGuidata } from './pagine/procedura-guidata';

/**
 * Finché l'installazione non è configurata l'unica pagina raggiungibile è la
 * procedura guidata al primo avvio.
 */
function Instradamento() {
  const { stato, inCaricamento, errore } = usaInstallazione();

  if (inCaricamento) {
    return <Caricamento messaggio="Caricamento del salone" />;
  }

  if (errore || !stato) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <Avviso tono="errore">{errore ?? 'Stato del salone non disponibile.'}</Avviso>
      </main>
    );
  }

  if (!stato.configurata) {
    return (
      <Routes>
        <Route path="/procedura-guidata" element={<PaginaProceduraGuidata />} />
        <Route path="*" element={<Navigate to="/procedura-guidata" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/accesso" element={<PaginaAccesso />} />
      <Route path="/attivazione" element={<PaginaAttivazione />} />
      <Route path="/procedura-guidata" element={<Navigate to="/" replace />} />
      <Route
        path="/impostazioni"
        element={
          <RottaProtetta ruoliConsentiti={['titolare']}>
            <PaginaImpostazioni />
          </RottaProtetta>
        }
      />
      <Route
        path="/"
        element={
          <RottaProtetta>
            <PaginaPannello />
          </RottaProtetta>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <FornitoreInstallazione>
      <FornitoreSessione>
        <BrowserRouter>
          <Instradamento />
        </BrowserRouter>
      </FornitoreSessione>
    </FornitoreInstallazione>
  );
}
