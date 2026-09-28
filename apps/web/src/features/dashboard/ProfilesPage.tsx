import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listProfiles, type BasicProfile } from '../profiles/profileApi';

export function ProfilesPage() {
  const [role, setRole] = useState<BasicProfile['papel']>('MORADOR');
  const [page, setPage] = useState(1);
  const [profiles, setProfiles] = useState<BasicProfile[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void listProfiles(role, page).then((result) => {
      if (!active) return;
      setProfiles(result.dados);
      setTotal(result.paginacao.total);
      setTotalPages(result.paginacao.totalPaginas);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os perfis.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [role, page]);

  return <main className="min-h-screen bg-neutral-50 px-screen py-8 text-neutral-900">
    <div className="mx-auto max-w-dashboard space-y-6">
      <Link to="/dashboard" className="font-semibold text-operational-700">← Voltar ao dashboard</Link>
      <header>
        <p className="text-sm font-bold uppercase text-operational-700">Operação EcoRota</p>
        <h1 className="text-3xl font-bold">Perfis de moradores e coletores</h1>
        <p className="mt-2 text-neutral-600">Informações básicas e quantidade de coletas concluídas.</p>
      </header>
      <div className="flex gap-2" role="group" aria-label="Tipo de perfil">
        {(['MORADOR', 'COLETOR'] as const).map((item) => <button key={item} type="button"
          onClick={() => { setRole(item); setPage(1); }}
          className={`min-h-touch rounded-md px-4 font-semibold ${role === item ? 'bg-operational-700 text-white' : 'bg-white text-neutral-700'}`}>
          {item === 'MORADOR' ? 'Moradores' : 'Coletores'}
        </button>)}
      </div>
      {loading && <p role="status">Carregando perfis…</p>}
      {error && <p role="alert" className="rounded-md bg-danger-50 p-4 text-danger-800">{error}</p>}
      {!loading && !error && <>
        <p>{total} {role === 'MORADOR' ? 'moradores' : 'coletores'}</p>
        {profiles.length === 0 ? <p>Nenhum perfil encontrado.</p> : <ul className="grid gap-3 md:grid-cols-2">
          {profiles.map((profile) => <li key={profile.id} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
            <h2 className="text-xl font-bold">{profile.nome}</h2>
            <p className="mt-1 text-sm text-neutral-600">Cadastrado em {new Date(profile.cadastradoEm).toLocaleDateString('pt-BR')}</p>
            <p className="mt-4 text-2xl font-bold text-operational-700">{profile.coletasConcluidas} <span className="text-base font-normal text-neutral-600">coletas concluídas</span></p>
            {profile.papel === 'COLETOR' && <p className="mt-2 text-sm text-neutral-600">{profile.disponivel ? 'Disponível' : 'Indisponível'}{profile.turno ? ` · ${profile.turno}` : ''}</p>}
          </li>)}
        </ul>}
        <div className="flex items-center gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border px-4 py-2 disabled:opacity-40">Anterior</button>
          <span>Página {page} de {Math.max(totalPages, 1)}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-md border px-4 py-2 disabled:opacity-40">Próxima</button>
        </div>
      </>}
    </div>
  </main>;
}
