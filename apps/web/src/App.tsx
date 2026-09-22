import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ColetorRoutes } from './features/coletor/routes';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/coletor/*" element={<ColetorRoutes />} />
        <Route path="/dashboard" element={<div>Dashboard operacional</div>} />
        <Route path="*" element={<div>EcoRota — escolha seu perfil</div>} />
      </Routes>
    </BrowserRouter>
  );
}