import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Login from './components/Login';
import Upload from './components/Upload';
import VideoList from './components/VideoList';
import Watch from './components/Watch';
import Channel from './components/Channel';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/watch" element={<Watch />} />
        <Route path="/channel/:userId" element={<Channel />} />
        <Route path="/" element={<VideoList />} />
      </Routes>
    </Router>
  );
}

export default App;
