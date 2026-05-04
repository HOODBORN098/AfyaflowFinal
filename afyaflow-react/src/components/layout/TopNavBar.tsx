import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, HelpCircle, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSearch } from '../../context/SearchContext';
import { notificationApi } from '../../services/api';
import { toast } from 'sonner';

interface Props {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const TopNavBar: React.FC<Props> = ({ isSidebarCollapsed, toggleSidebar }) => {
  const { user, logout } = useAuth();
  const { searchQuery, setSearchQuery } = useSearch();
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // Notification State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  React.useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const [notifsRes, countRes] = await Promise.all([
          notificationApi.getAll(),
          notificationApi.getUnreadCount()
        ]);
        setNotifications(notifsRes.data);
        setUnreadCount(countRes.data);
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to mark all as read');
    }
  };

  const displayUser = user ? {
    name: user.username,
    role: user.role,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=0D9488&color=fff`
  } : {
    name: 'Guest User',
    role: 'Unauthorized',
    avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className={`fixed top-0 right-0 h-16 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none flex justify-between items-center px-8 transition-all duration-300 ${isSidebarCollapsed ? 'left-20' : 'left-64'}`}>
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="p-2 rounded-lg text-slate-500 hover:bg-surface-container-low transition-colors">
          <span className="material-symbols-outlined">{isSidebarCollapsed ? 'menu_open' : 'menu'}</span>
        </button>
        <div className="flex items-center gap-4 bg-surface-container-low px-4 py-2 rounded-full w-96 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
        <Search className="w-5 h-5 text-slate-400 dark:text-white/60" />
        <input 
          className="bg-transparent border-none focus:ring-0 text-sm w-full text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40" 
          placeholder="Global search..." 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={`transition-all relative p-2 rounded-lg ${showNotifications ? 'bg-teal-50 text-teal-600' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-pulse text-teal-600' : ''}`} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-4 w-4 bg-red-500 text-white text-[8px] font-black rounded-full border-2 border-white flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-sm text-slate-800">Alerts</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-bold text-teal-600 hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      onClick={() => !n.isRead && handleMarkAsRead(n.id)}
                      className={`p-4 border-b border-slate-50 last:border-0 cursor-pointer transition-colors ${n.isRead ? 'opacity-60 hover:bg-slate-50' : 'bg-teal-50/30 hover:bg-teal-50/50'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${n.isRead ? 'bg-slate-300' : 'bg-teal-500'}`} />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-800 leading-tight mb-1">{n.title}</p>
                          <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">{n.message}</p>
                          <p className="text-[9px] text-slate-400 mt-2 font-medium">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-medium">No new alerts</p>
                  </div>
                )}
              </div>
              {notifications.length > 0 && (
                <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-center">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Clinical Alerts System</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        <button className="text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-300 transition-all p-1 rounded-lg hover:bg-surface-container-low">
          <HelpCircle className="w-5 h-5" />
        </button>
        
        <div className="h-8 w-[1px] bg-outline-variant/30 mx-2"></div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 group">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">{displayUser.name}</p>
              <p className="text-[10px] text-slate-500 dark:text-white/60 font-medium uppercase tracking-wider">{displayUser.role}</p>
            </div>
            <img 
              alt="User Avatar" 
              className="h-10 w-10 rounded-full border-2 border-primary-container/20 group-hover:border-primary transition-all object-cover" 
              src={displayUser.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
            />
          </div>

          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-error hover:bg-error/5 rounded-xl transition-all border border-transparent hover:border-error/20 group"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Beautiful Logout Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <LogOut className="w-8 h-8 text-red-600 dark:text-red-400 translate-x-0.5" />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">Ready to Leave?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-center text-sm mb-8">
              Are you sure you want to log out? You will need to sign in again to access your dashboard.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmLogout}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 shadow-lg shadow-red-600/20 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default TopNavBar;

