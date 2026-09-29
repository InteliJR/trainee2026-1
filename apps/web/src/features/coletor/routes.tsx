import { Navigate, Route, Routes } from 'react-router-dom';
import { ColetorShell } from './components/ColetorShell';
import { RequireCollector } from './components/RequireCollector';
import DetalheColetaPage from './pages/DetalheColetaPage';
import DisponibilidadePage from './pages/DisponibilidadePage';
import LoginPage from './pages/LoginPage';
import PainelDiaPage from './pages/PainelDiaPage';
import PerfilPage from './pages/PerfilPage';

// Montado em /coletor/* (ver App.tsx). Tudo exige login, exceto /coletor/login.
export function ColetorRoutes() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route
        element={
          <RequireCollector>
            <ColetorShell />
          </RequireCollector>
        }
      >
        <Route index element={<PainelDiaPage />} />
        <Route path="coletas/:id" element={<DetalheColetaPage />} />
        <Route path="disponibilidade" element={<DisponibilidadePage />} />
        <Route path="perfil" element={<PerfilPage />} />
        <Route path="*" element={<Navigate to="/coletor" replace />} />
      </Route>
    </Routes>
  );
}
