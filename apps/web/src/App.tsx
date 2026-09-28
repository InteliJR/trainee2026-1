import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AcompanharStatusPage } from './features/morador/pages/AcompanharStatusPage';
import { SolicitarColetaPage } from './features/morador/pages/SolicitarColetaPage';
import { HistoricoImpactoPage } from './features/morador/pages/HistoricoImpactoPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/morador" element={<SolicitarColetaPage />} />
        <Route path="/morador/solicitar" element={<SolicitarColetaPage />} />
        <Route path="/morador/acompanhar" element={<AcompanharStatusPage />} />
        <Route path="/morador/historico" element={<HistoricoImpactoPage />} />
        <Route path="/coletor" element={<div>Area do coletor</div>} />
        <Route path="/dashboard" element={<div>Dashboard operacional</div>} />
        <Route path="*" element={<SolicitarColetaPage />} />
      </Routes>
    </BrowserRouter>
  );
}
