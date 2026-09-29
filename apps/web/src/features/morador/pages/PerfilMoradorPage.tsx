import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EcoPageHeader } from '../components/EcoPageHeader';
import { ResidentBottomNav } from '../components/ResidentBottomNav';
import { getOwnProfile, type BasicProfile } from '../../profiles/profileApi';
import { logoutResident } from '../lib/residentAuth';

export function PerfilMoradorPage() {
  const [profile, setProfile] = useState<BasicProfile | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    void getOwnProfile().then((result) => { if (active) setProfile(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o perfil.'); });
    return () => { active = false; };
  }, []);

  async function leave() {
    await logoutResident().catch(() => undefined);
    navigate('/morador/login', { replace: true });
  }

  return <main className="eco-page min-h-screen px-screen pb-28 pt-6 text-neutral-950">
    <div className="mx-auto max-w-app space-y-6">
      <EcoPageHeader eyebrow="Morador" title="Meu perfil" description="Seus dados básicos e sua participação nas coletas." />
      {error && <p role="alert" className="rounded-lg bg-danger-50 p-4 text-danger-800">{error}</p>}
      {!profile && !error && <p role="status">Carregando perfil…</p>}
      {profile && <section className="eco-panel rounded-lg p-5">
        <h2 className="text-2xl font-bold">{profile.nome}</h2>
        <p className="mt-2 text-neutral-600">Morador desde {new Date(profile.cadastradoEm).toLocaleDateString('pt-BR')}</p>
        <p className="mt-5 text-3xl font-bold text-brand-700">{profile.coletasConcluidas}</p>
        <p className="text-neutral-600">coletas concluídas</p>
      </section>}
      <button type="button" onClick={() => void leave()} className="eco-secondary-button min-h-touch w-full rounded-md border border-neutral-300 px-4 font-bold">Sair da conta</button>
    </div>
    <ResidentBottomNav activeItem="perfil" />
  </main>;
}
