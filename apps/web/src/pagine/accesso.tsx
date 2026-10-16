import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { schemaAccesso } from '@barber/shared';
import { usaSessione } from '../autenticazione/contesto-sessione';
import { ErroreApi } from '../servizi/client-api';
import { Superficie } from '../componenti/superficie';

export function PaginaAccesso() {
  const { utente, accedi } = usaSessione();
  const posizione = useLocation();
  const [email, impostaEmail] = useState('');
  const [password, impostaPassword] = useState('');
  const [errore, impostaErrore] = useState<string | null>(null);
  const [inInvio, impostaInInvio] = useState(false);

  if (utente) {
    const destinazione = (posizione.state as { da?: string } | null)?.da ?? '/';

    return <Navigate to={destinazione} replace />;
  }

  async function invia(evento: React.FormEvent) {
    evento.preventDefault();
    impostaErrore(null);

    const validazione = schemaAccesso.safeParse({ email, password });

    if (!validazione.success) {
      impostaErrore(validazione.error.issues[0]?.message ?? 'Dati non validi.');

      return;
    }

    impostaInInvio(true);

    try {
      await accedi(validazione.data.email, validazione.data.password);
    } catch (problema) {
      impostaErrore(
        problema instanceof ErroreApi ? problema.message : 'Accesso non riuscito. Riprova.',
      );
    } finally {
      impostaInInvio(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        <Superficie className="p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Accedi</h1>
          <p className="mt-1 text-sm text-testo-tenue">Gestionale del salone</p>

          <form onSubmit={invia} className="mt-8 space-y-5" noValidate>
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(evento) => impostaEmail(evento.target.value)}
                className="w-full rounded-xl border border-bordo bg-fondo-elevato px-3 py-2.5 text-sm outline-none transition focus:border-accento"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(evento) => impostaPassword(evento.target.value)}
                className="w-full rounded-xl border border-bordo bg-fondo-elevato px-3 py-2.5 text-sm outline-none transition focus:border-accento"
              />
            </div>

            {errore && (
              <p role="alert" className="text-sm text-errore">
                {errore}
              </p>
            )}

            <button
              type="submit"
              disabled={inInvio}
              className="w-full rounded-xl bg-accento px-4 py-2.5 text-sm font-semibold text-fondo transition hover:bg-accento-forte disabled:opacity-60"
            >
              {inInvio ? 'Accesso in corso…' : 'Accedi'}
            </button>
          </form>
        </Superficie>
      </motion.div>
    </main>
  );
}
