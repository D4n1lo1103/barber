/**
 * Preparazione dell'ambiente per i test di integrazione.
 *
 * Va eseguita **prima** che venga importato `AppModule`: `ConfigModule.forRoot`
 * legge e valida le variabili d'ambiente al momento dell'import, quindi
 * impostarle dentro un `beforeAll` sarebbe troppo tardi.
 */
process.env.NODE_ENV = 'test';
// Le attività vengono eseguite in linea: nessuna coda da attendere e nessun
// lavoro lasciato in sospeso fra un test e l'altro.
process.env.CODA_ATTIVA = 'false';
// Nessun SMTP: le e-mail restano nel mittente di prova, in memoria.
delete process.env.SMTP_HOST;
