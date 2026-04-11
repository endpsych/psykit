import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          {/* All routes are handled keep-alive in Layout — no Route elements needed */}
          <Route index element={null} />
          <Route path="spatial-rotation" element={null} />
          <Route path="number-series" element={null} />
          <Route path="progressive-matrices" element={null} />
          <Route path="verbal-reasoning" element={null} />
          <Route path="bank" element={null} />
          <Route path="test-builder" element={null} />
          <Route path="take-test" element={null} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
