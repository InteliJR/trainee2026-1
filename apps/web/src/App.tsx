import { BrowserRouter, Route, Routes } from 'react-router-dom';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/morador" element={<div>Área do morador</div>} />
        <Route path="/coletor" element={<div>Área do coletor</div>} />
        <Route path="/dashboard" element={<div>Dashboard operacional</div>} />
        <Route path="*" element={<div>EcoRota — escolha seu perfil</div>} />
      </Routes>
    </BrowserRouter>
  );
}