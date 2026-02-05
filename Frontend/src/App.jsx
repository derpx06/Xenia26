import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Prism from './utils/Prism';
import Landing from './pages/Landing';
import LoginPage from './pages/LoginPage'; 
import RegisterPage from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";
import OutreachChat from './pages/OutreachChat';

const App = () => {
  return (
    <div className="dark min-h-screen bg-neutral-950"> 
      {/* Optional global background animation */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <Prism 
          animationType="3drotate"
          timeScale={0.1}
          glow={1.2}
          bloom={1.5}
          scale={5}
        />
      </div>

      <div className="relative z-10">
        <Routes>
          {/* Default path shows the Landing page */}
          <Route path="/" element={<Landing />} />

          <Route path="/register" element={<RegisterPage />} />
          
          {/* Login path shows the LoginPage component */}
          <Route path="/login" element={<LoginPage />} />
          

          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/outreach" element={<OutreachChat />} />

          
          {/* ✅ 2. Replace placeholder with the actual Dashboard component */}
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;