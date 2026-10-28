import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AIProvider } from './context/AIContext';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { Camps } from './pages/Camps';
import { Warehouse } from './pages/Warehouse';
import { Dispatches } from './pages/Dispatches';
import { Donations } from './pages/Donations';
import { Volunteers } from './pages/Volunteers';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppProvider>
        <AIProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/camps" element={<Camps />} />
              <Route path="/warehouse" element={<Warehouse />} />
              <Route path="/dispatches" element={<Dispatches />} />
              <Route path="/donations" element={<Donations />} />
              <Route path="/volunteers" element={<Volunteers />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </AIProvider>
      </AppProvider>
    </BrowserRouter>
  );
};

export default App;
