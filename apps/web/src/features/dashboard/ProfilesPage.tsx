import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, buttonClasses } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Dialog } from '../../components/Dialog';
import { Field, focusFirstInvalid } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { InlineNotice } from '../../components/InlineNotice';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateView';
import { ApiError } from '../../lib/api';
import { listProfiles, createProfile, updateProfile, deleteProfile, type BasicProfile, type CreateProfileInput, type UpdateProfileInput } from '../profiles/profileApi';

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Ocorreu um erro inesperado.';
}

type FormMode = 'create' | 'edit' | null;

export function ProfilesPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<BasicProfile['papel']>('MORADOR');
  const [page, setPage] = useState(1);
  const [profiles, setProfiles] = useState<BasicProfile[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingProfile, setEditingProfile] = useState<BasicProfile | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState<BasicProfile | null>(null);

  const load = () => {
    setLoading(true);
    setError('');
    void listProfiles(role, page).then((result) => {
      setProfiles(result.dados);
      setTotal(result.paginacao.total);
      setTotalPages(result.paginacao.totalPaginas);
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os perfis.');
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [role, page]);

  const totalCollections = profiles.reduce((sum, p) => sum + p.coletasConcluidas, 0);

  async function handleCreate(input: CreateProfileInput) {
    setSaving(true);
    setFormError('');
    try {
      await createProfile(input);
      setFormMode(null);
      setFeedback('Perfil criado com sucesso.');
      load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) navigate('/operador/login', { replace: true });
      setFormError(errorMessage(error));
    } finally { setSaving(false); }
  }

  async function handleUpdate(input: UpdateProfileInput) {
    if (!editingProfile) return;
    setSaving(true);
    setFormError('');
    try {
      await updateProfile(editingProfile.id, input);
      setFormMode(null);
      setEditingProfile(null);
      setFeedback('Perfil atualizado com sucesso.');
      load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) navigate('/operador/login', { replace: true });
      setFormError(errorMessage(error));
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deletingProfile) return;
    setSaving(true);
    try {
      await deleteProfile(deletingProfile.id);
      setDeletingProfile(null);
      setFeedback('Perfil excluído com sucesso.');
      load();
    } catch (error) {
      setFeedback('');
      setError(errorMessage(error));
    } finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 border-t-4 border-t-operational-600 bg-neutral-0 px-screen py-4 lg:px-6">
        <div className="mx-auto flex max-w-dashboard flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-operational-700">Operação EcoRota</p>
            <h1 className="text-2xl font-bold">Perfis de moradores e coletores</h1>
            <p className="mt-1 text-sm text-neutral-600">Gerencie os usuários da plataforma.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard" className={buttonClasses('secondary')}>
              <Icon name="arrowLeft" className="h-4 w-4" />
              Voltar ao dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-dashboard space-y-6 px-screen py-6 lg:px-6">
        <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo dos perfis">
          <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-kpi"><p className="text-sm text-neutral-600">Total de perfis</p><p className="mt-1 text-2xl font-bold tabular-nums">{loading ? '—' : total}</p></div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-kpi"><p className="text-sm text-neutral-600">Coletas concluídas</p><p className="mt-1 text-2xl font-bold tabular-nums text-brand-700">{loading ? '—' : totalCollections}</p></div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-kpi"><p className="text-sm text-neutral-600">Página</p><p className="mt-1 text-2xl font-bold tabular-nums">{page} / {Math.max(totalPages, 1)}</p></div>
        </section>

        {feedback ? <InlineNotice tone="success">{feedback}</InlineNotice> : null}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de perfil">
            {(['MORADOR', 'COLETOR'] as const).map((item) => (
              <button key={item} type="button" aria-pressed={role === item} onClick={() => { setRole(item); setPage(1); }}
                className={`min-h-touch rounded-full border px-4 text-sm font-semibold ${role === item ? 'border-operational-700 bg-operational-700 text-neutral-0' : 'border-neutral-300 bg-neutral-0 text-neutral-700 hover:bg-neutral-100'}`}>
                {item === 'MORADOR' ? 'Moradores' : 'Coletores'}
              </button>
            ))}
          </div>
          <Button onClick={() => { setFormMode('create'); setFormError(''); }}>Novo perfil</Button>
        </div>

        {loading ? <LoadingState label="Carregando perfis…" /> : error ? <ErrorState message={error} onRetry={load} /> : profiles.length === 0 ? (
          <EmptyState title="Nenhum perfil encontrado" description="Crie o primeiro perfil desta categoria." action={<Button onClick={() => setFormMode('create')}>Novo perfil</Button>} />
        ) : (
          <>
            <InlineNotice tone="info">{total} {role === 'MORADOR' ? 'morador(es)' : 'coletor(es)'} encontrado(s)</InlineNotice>
            <ul className="grid gap-3 md:grid-cols-2">
              {profiles.map((profile) => (
                <li key={profile.id} className="rounded-lg border border-neutral-200 bg-neutral-0 p-5 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-neutral-900">{profile.nome}</h2>
                      <p className="mt-1 text-sm text-neutral-600">{profile.email ?? 'Sem e-mail'}</p>
                      <p className="text-sm text-neutral-600">Cadastrado em {new Date(profile.cadastradoEm).toLocaleDateString('pt-BR')}</p>
                    </div>
                    {profile.papel === 'COLETOR' && (
                      <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${profile.disponivel ? 'bg-brand-100 text-brand-800' : 'bg-neutral-200 text-neutral-700'}`}>
                        {profile.disponivel ? 'Disponível' : 'Indisponível'}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums text-operational-700">{profile.coletasConcluidas}</span>
                    <span className="text-sm text-neutral-600">coletas concluídas</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => { setEditingProfile(profile); setFormMode('edit'); setFormError(''); }}>Editar</Button>
                    <Button variant="danger" onClick={() => setDeletingProfile(profile)}>Excluir</Button>
                  </div>
                </li>
              ))}
            </ul>
            <nav className="flex items-center justify-between gap-3" aria-label="Paginação">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
              <span className="text-sm text-neutral-600">Página {page} de {Math.max(totalPages, 1)}</span>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Próxima</Button>
            </nav>
          </>
        )}
      </div>

      <ProfileFormDialog
        open={formMode !== null}
        title={formMode === 'create' ? 'Novo perfil' : 'Editar perfil'}
        initialName={editingProfile?.nome}
        initialEmail={editingProfile?.email}
        initialPhone={undefined}
        initialRole={formMode === 'create' ? role : undefined}
        loading={saving}
        apiError={formError}
        onClose={() => { if (!saving) { setFormMode(null); setEditingProfile(null); } }}
        onSubmit={formMode === 'create' ? handleCreate : (input) => handleUpdate({ nome: input.nome, email: input.email, telefone: input.telefone })}
      />

      <ConfirmDialog open={Boolean(deletingProfile)} title="Excluir perfil?" cancelLabel="Manter" confirmLabel="Excluir" confirmVariant="danger-solid" loading={saving}
        onCancel={() => setDeletingProfile(null)} onConfirm={() => void handleDelete()}>
        O perfil "{deletingProfile?.nome}" será removido permanentemente. Esta ação não pode ser desfeita.
      </ConfirmDialog>
    </main>
  );
}

interface ProfileFormDialogProps {
  open: boolean;
  title: string;
  initialName?: string;
  initialEmail?: string;
  initialPhone?: string;
  initialRole?: 'MORADOR' | 'COLETOR';
  loading: boolean;
  apiError: string;
  onClose: () => void;
  onSubmit: (input: CreateProfileInput) => Promise<void>;
}

function ProfileFormDialog({ open, title, initialName, initialEmail, initialPhone, initialRole, loading, apiError, onClose, onSubmit }: ProfileFormDialogProps) {
  const [nome, setNome] = useState(initialName ?? '');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [telefone, setTelefone] = useState(initialPhone ?? '');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState<'MORADOR' | 'COLETOR'>(initialRole ?? 'MORADOR');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const isEdit = Boolean(initialName);
  const formKey = `${initialName ?? ''}-${initialEmail ?? ''}`;

  const [renderKey, setRenderKey] = useState(formKey);
  if (renderKey !== formKey) { setRenderKey(formKey); setNome(initialName ?? ''); setEmail(initialEmail ?? ''); setTelefone(initialPhone ?? ''); setSenha(''); setPapel(initialRole ?? 'MORADOR'); setErrors({}); }

  function validate(): boolean {
    const e: Partial<Record<string, string>> = {};
    if (nome.trim().length < 2) e.nome = 'Nome deve ter pelo menos 2 caracteres.';
    if (!email.trim() || !email.includes('@')) e.email = 'Informe um e-mail válido.';
    if (!isEdit && senha.length < 8) e.senha = 'Senha deve ter pelo menos 8 caracteres.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) { focusFirstInvalid(event.currentTarget); return; }
    void onSubmit({ nome: nome.trim(), email: email.trim().toLowerCase(), telefone: telefone.trim() || undefined, senha, papel });
  }

  return (
    <Dialog open={open} title={title} busy={loading} wide onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {apiError ? <InlineNotice tone="error">{apiError}</InlineNotice> : null}
        <Field label="Nome completo" required value={nome} error={errors.nome} onChange={(e) => setNome(e.target.value)} data-autofocus />
        <Field label="E-mail" type="email" required value={email} error={errors.email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Telefone" optional value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        {!isEdit && <Field label="Senha" type="password" required value={senha} error={errors.senha} onChange={(e) => setSenha(e.target.value)} hint="Mínimo 8 caracteres" />}
        {!isEdit && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-neutral-800">Papel</legend>
            <div className="flex gap-3">
              {(['MORADOR', 'COLETOR'] as const).map((r) => (
                <label key={r} className={`flex min-h-touch cursor-pointer items-center gap-2 rounded-md border-2 px-4 text-sm font-semibold ${papel === r ? 'border-brand-600 bg-brand-50' : 'border-neutral-300 bg-neutral-0'}`}>
                  <input type="radio" name="papel" value={r} checked={papel === r} onChange={() => setPapel(r)} className="h-4 w-4 accent-brand-600" />
                  {r === 'MORADOR' ? 'Morador' : 'Coletor'}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="lg" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" size="lg" loading={loading} loadingText="Salvando…">{isEdit ? 'Salvar alterações' : 'Criar perfil'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
