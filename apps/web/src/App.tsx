import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { MapContainer } from './map/MapContainer';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/morador" element={<div>Área do morador</div>} />
        <Route path="/coletor" element={<div>Área do coletor</div>} />
        <Route
          path="/dashboard"
          element={
            <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
              <h1 style={{ padding: '16px', margin: 0, fontFamily: 'sans-serif' }}>Dashboard Operacional EcoRota</h1>
              <div style={{ flex: 1 }}>
                <MapContainer />
              </div>
            </div>
          }
        />
        <Route
          path="*"
          element={
            <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
              <h1 style={{ padding: '16px', margin: 0, fontFamily: 'sans-serif' }}>EcoRota — Escolha seu perfil ou visualize o mapa</h1>
              <div style={{ flex: 1 }}>
                <MapContainer />
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}