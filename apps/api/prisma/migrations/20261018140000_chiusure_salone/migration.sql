-- AlterEnum
-- Le chiusure straordinarie del salone (festività, chiusura dell'intera
-- attività) sono assenze di tutti gli operatori, registrate da un unico flusso.
ALTER TYPE "TipoAssenza" ADD VALUE 'chiusura';
