import { Route, Routes } from 'react-router-dom';
import Header from './Component/Header';
import LoadData from './Component/LoadData';
import ListSheet from './Component/sheet/ListSheet';
import ListTopic from './Component/topic/ListTopic';
import ListProblem from './Component/problem/ListProblem';
import OpenProblem from './Component/problem/OpenDashboard';
import EditProblem from './Component/problem/EditProblem';
import { useData } from './data/DataContext';
import './App.css';

const App = () => {
  const { loaded, busy } = useData();

  return (
    <div className="app">
      <Header />
      <main className="app__main">
        {busy ? (
          <div className="loading-screen">
            <div className="loading-screen__spinner"></div>
            <span className="loading-screen__label">Loading data…</span>
          </div>
        ) : !loaded ? (
          <LoadData />
        ) : (
          <Routes>
            <Route path="/" element={<ListSheet />} />
            {/* ID-only (modern) routes */}
            <Route path="/topic/:sheetId" element={<ListTopic />} />
            <Route path="/problem/:sheetId/:topicId" element={<ListProblem />} />
            <Route path="/problem/open/:sheetId/:topicId/:problemId" element={<OpenProblem />} />
            <Route path="/problem/edit/:sheetId/:topicId/:problemId" element={<EditProblem />} />
            {/* Legacy routes with trailing names — params after IDs are ignored */}
            <Route path="/topic/:sheetId/:sheet" element={<ListTopic />} />
            <Route path="/problem/:sheetId/:topicId/:sheet/:topic" element={<ListProblem />} />
            <Route path="/problem/open/:sheetId/:topicId/:problemId/:sheet/:topic" element={<OpenProblem />} />
            <Route path="/problem/edit/:sheetId/:topicId/:problemId/:sheet/:topic" element={<EditProblem />} />
            <Route path="*" element={<ListSheet />} />
          </Routes>
        )}
      </main>
    </div>
  );
};

export default App;
