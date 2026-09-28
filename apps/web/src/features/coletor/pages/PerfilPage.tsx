import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Icon } from '../../../components/Icon';
import { InlineNotice } from '../../../components/InlineNotice';
import { PageTitle } from '../../../components/PageTitle';
import { useAuth } from '../auth/AuthContext';
import { MESSAGES, friendlyError } from '../lib/messages';

// Perfil do coletor: quem está logado e a saída da conta. "Sair" pede confirmação para não ser tocado sem querer.
export default function PerfilPage() {
  const { collector, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string>();

  async function confirmLogout() {
    setLeaving(true);
    try {
      await logout();
      navigate('/coletor/login', { replace: true });
    } catch (e) {
      setError(friendlyError(e, MESSAGES.actionError));
      setLeaving(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="space-y-section">
      <PageTitle>Perfil</PageTitle>

      {error && <InlineNotice tone="error">{error}</InlineNotice>}

      <dl className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-neutral-0 px-4 shadow-card">
        <div className="py-3">
          <dt className="text-base text-neutral-700">Nome</dt>
          <dd className="text-2xl font-bold text-neutral-900">{collector?.name}</dd>
        </div>
        <div className="py-3">
          <dt className="text-base text-neutral-700">E-mail</dt>
          <dd className="text-lg font-bold text-neutral-900">{collector?.email}</dd>
        </div>
      </dl>

      <Button size="lg" variant="secondary" fullWidth icon={<Icon name="logout" />} onClick={() => setConfirmOpen(true)}>
        Sair da conta
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title="Sair da conta?"
        cancelLabel="Ficar no app"
        confirmLabel="Sim, sair"
        confirmVariant="danger"
        loading={leaving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmLogout}
      >
        Para ver suas coletas de novo, você vai precisar entrar outra vez.
      </ConfirmDialog>
    </div>
  );
}
