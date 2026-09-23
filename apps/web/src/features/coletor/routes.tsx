import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ColetorShell } from './components/ColetorShell';
import { RequireAuth } from './components/RequireAuth';
import DetalheColetaPage from './pages/DetalheColetaPage';
import DisponibilidadePage from './pages/DisponibilidadePage';
import LoginPage from './pages/LoginPage';
import PainelDiaPage from './pages/PainelDiaPage';

// Montado em /coletor/* (ver App.tsx). Tudo exige login, exceto /coletor/login.
export function ColetorRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <ColetorShell />
            </RequireAuth>
          }
        >
          <Route index element={<PainelDiaPage />} />
          <Route path="coletas/:id" element={<DetalheColetaPage />} />
          <Route path="disponibilidade" element={<DisponibilidadePage />} />
          <Route path="*" element={<Navigate to="/coletor" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
