/** Define a navegação atual e entrega o painel operacional conectado ao Socket.IO. */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RealtimeDashboard } from './features/dashboard/RealtimeDashboard';
import { ColetorRoutes } from './features/coletor/routes';
import { AcompanharStatusPage } from './features/morador/pages/AcompanharStatusPage';
import { SolicitarColetaPage } from './features/morador/pages/SolicitarColetaPage';
import { HistoricoImpactoPage } from './features/morador/pages/HistoricoImpactoPage';

// Monta as rotas do MVP: morador, coletor e painel operacional.
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/morador" element={<SolicitarColetaPage />} />
        <Route path="/morador/solicitar" element={<SolicitarColetaPage />} />
        <Route path="/morador/acompanhar" element={<AcompanharStatusPage />} />
        <Route path="/morador/historico" element={<HistoricoImpactoPage />} />
        <Route path="/coletor/*" element={<ColetorRoutes />} />
        <Route path="/dashboard" element={<RealtimeDashboard />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
