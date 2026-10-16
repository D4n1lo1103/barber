import { BrowserRouter, Route, Routes } from 'react-router';
import { FornitoreSessione } from './autenticazione/contesto-sessione';
import { RottaProtetta } from './componenti/rotta-protetta';
import { PaginaAccesso } from './pagine/accesso';
import { PaginaPannello } from './pagine/pannello';

export function App() {
  return (
    <FornitoreSessione>
      <BrowserRouter>
        <Routes>
          <Route path="/accesso" element={<PaginaAccesso />} />
          <Route
            path="/"
            element={
              <RottaProtetta>
                <PaginaPannello />
              </RottaProtetta>
            }
          />
        </Routes>
      </BrowserRouter>
    </FornitoreSessione>
  );
}
