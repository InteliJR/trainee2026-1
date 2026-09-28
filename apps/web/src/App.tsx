/** Define a navegação atual e entrega o painel operacional conectado ao Socket.IO. */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireRole } from './components/RequireRole';
import { LoginOperadorPage } from './features/dashboard/LoginOperadorPage';
import { checkOperatorSession } from './features/dashboard/operatorAuth';
import { RealtimeDashboard } from './features/dashboard/RealtimeDashboard';
import { EscolhaPerfilPage } from './features/inicio/EscolhaPerfilPage';
import { ColetorRoutes } from './features/coletor/routes';
import { RequireResident } from './features/morador/components/RequireResident';
import { AcompanharStatusPage } from './features/morador/pages/AcompanharStatusPage';
import { LoginMoradorPage } from './features/morador/pages/LoginMoradorPage';
import { SolicitarColetaPage } from './features/morador/pages/SolicitarColetaPage';
import { HistoricoImpactoPage } from './features/morador/pages/HistoricoImpactoPage';

// Monta as rotas do MVP: escolha de perfil, morador, coletor e painel operacional.
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EscolhaPerfilPage />} />
        <Route path="/morador/login" element={<LoginMoradorPage />} />
        <Route path="/morador" element={<RequireResident><SolicitarColetaPage /></RequireResident>} />
        <Route path="/morador/solicitar" element={<RequireResident><SolicitarColetaPage /></RequireResident>} />
        <Route path="/morador/acompanhar" element={<RequireResident><AcompanharStatusPage /></RequireResident>} />
        <Route path="/morador/historico" element={<RequireResident><HistoricoImpactoPage /></RequireResident>} />
        <Route path="/coletor/*" element={<ColetorRoutes />} />
        <Route path="/operador/login" element={<LoginOperadorPage />} />
        <Route
          path="/dashboard"
          element={<RequireRole check={checkOperatorSession} loginPath="/operador/login"><RealtimeDashboard /></RequireRole>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
