import { Link, Outlet } from 'react-router-dom';

// Casca da área do coletor: cabeçalho de alto contraste e conteúdo de uma coluna.
// A navegação (Hoje / Disponível / Perfil, do guia) entra quando as outras telas existirem (dias 5+).
export function ColetorShell() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-10 bg-brand-700 text-white">
        <div className="mx-auto flex max-w-app items-center justify-between px-screen py-3">
          <Link to="/coletor" className="min-h-touch flex items-center text-xl font-bold">
            EcoRota
          </Link>
          <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-brand-800">Coletor</span>
        </div>
      </header>

      <main className="mx-auto max-w-app px-screen pb-10 pt-section">
        <Outlet />
      </main>
    </div>
  );
}
