import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SolicitarColetaPage } from './features/morador/pages/SolicitarColetaPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/morador" element={<SolicitarColetaPage />} />
        <Route path="/morador/solicitar" element={<SolicitarColetaPage />} />
        <Route path="/coletor" element={<div>Area do coletor</div>} />
        <Route path="/dashboard" element={<div>Dashboard operacional</div>} />
        <Route path="*" element={<SolicitarColetaPage />} />
      </Routes>
    </BrowserRouter>
  );
}
