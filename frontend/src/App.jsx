import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewSession from './pages/NewSession';
import SessionAnalysis from './pages/SessionAnalysis';
import BaseRates from './pages/BaseRates';
import SourceEvents from './pages/SourceEvents';
import Calibration from './pages/Calibration';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sessions/new" element={<NewSession />} />
          <Route path="/sessions/:id" element={<SessionAnalysis />} />
          <Route path="/base-rates" element={<BaseRates />} />
          <Route path="/source-events" element={<SourceEvents />} />
          <Route path="/calibration" element={<Calibration />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
