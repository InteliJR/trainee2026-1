import { Navigate, Route, Routes } from 'react-router-dom';
import { ColetorShell } from './components/ColetorShell';
import DetalheColetaPage from './pages/DetalheColetaPage';
import PainelDiaPage from './pages/PainelDiaPage';

// Montado em /coletor/* (ver App.tsx). Sem login por enquanto: a auth entra nos dias 5–6 do plano.
export function ColetorRoutes() {
  return (
    <Routes>
      <Route element={<ColetorShell />}>
        <Route index element={<PainelDiaPage />} />
        <Route path="coletas/:id" element={<DetalheColetaPage />} />
        <Route path="*" element={<Navigate to="/coletor" replace />} />
      </Route>
    </Routes>
  );
}
