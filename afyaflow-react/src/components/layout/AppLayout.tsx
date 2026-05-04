import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import SideNavBar from './SideNavBar';
import TopNavBar from './TopNavBar';
import { useAuth } from '../../context/AuthContext';

const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);

  return (
    <div className="min-h-screen bg-background text-on-surface antialiased font-manrope flex">
      {isAuthenticated && <SideNavBar isCollapsed={isSidebarCollapsed} />}
      <div className="flex-1 flex flex-col min-h-screen">
        {isAuthenticated && <TopNavBar isSidebarCollapsed={isSidebarCollapsed} toggleSidebar={toggleSidebar} />}
        <main className={`flex-1 transition-all duration-300 ${isAuthenticated ? (isSidebarCollapsed ? 'ml-20' : 'ml-64') + ' pt-24 p-10' : ''}`}>
          <div className={isAuthenticated ? 'max-w-[1600px] mx-auto' : ''}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;

