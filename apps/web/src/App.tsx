/** Define a navegação atual e entrega o painel operacional conectado ao Socket.IO. */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RealtimeDashboard } from './features/dashboard/RealtimeDashboard';
import { ColetorRoutes } from './features/coletor/routes';

// Monta as rotas do MVP e mantém áreas ainda não implementadas como marcadores explícitos.
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/morador" element={<div>Área do morador</div>} />
        <Route path="/coletor/*" element={<ColetorRoutes />} />
        <Route path="/dashboard" element={<RealtimeDashboard />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
