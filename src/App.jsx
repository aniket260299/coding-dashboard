import React from 'react';
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

    return (<>
        <Header />
        <div style={{ padding: '20px 30px' }}>
            {busy ? <div className="loading-spinner"></div>
                : !loaded ? <LoadData />
                    : <Routes>
                        <Route path="/" element={<ListSheet />} />
                        <Route path="/topic/:sheetId/:sheet" element={<ListTopic />} />
                        <Route path="/problem/:sheetId/:topicId/:sheet/:topic" element={<ListProblem />} />
                        <Route path="/problem/open/:sheetId/:topicId/:problemId/:sheet/:topic" element={<OpenProblem />} />
                        <Route path="/problem/edit/:sheetId/:topicId/:problemId/:sheet/:topic" element={<EditProblem />} />
                        <Route path="*" element={<ListSheet />} />
                    </Routes>}
        </div>
    </>);
};

export default App;
