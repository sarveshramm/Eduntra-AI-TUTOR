import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { BookOpen, Bot, Briefcase, Video, LogOut, Menu, X, User, GraduationCap } from 'lucide-react';
import AITutor from '../components/AITutor/AITutor';
import Learning from '../components/Learning/Learning';
import Career from '../components/Career/Career';
import Jobs from '../components/Jobs/Jobs';
import LiveClasses from '../components/LiveClasses/LiveClasses';
import TeacherDashboard from '../components/Teacher/TeacherDashboard';
import { toast } from 'sonner';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tutor');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) {
    navigate('/');
    return null;
  }

  const navigation = user?.role === 'teacher' ? [
    { id: 'teacher', label: 'Dashboard', icon: GraduationCap },
    { id: 'classes', label: 'Live Classes', icon: Video },
  ] : [
    { id: 'tutor', label: 'AI Tutor', icon: Bot },
    { id: 'learning', label: 'Learning', icon: BookOpen },
    { id: 'career', label: 'Career', icon: Briefcase },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'classes', label: 'Live Classes', icon: Video },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900" data-testid="dashboard">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-white"
              data-testid="menu-toggle"
            >
              {sidebarOpen ? <X /> : <Menu />}
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white" style={{fontFamily: 'Space Grotesk'}}>Eduntra AI</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 glass-effect px-4 py-2 rounded-full">
              <User className="h-5 w-5 text-green-400" />
              <span className="text-white font-medium">{user?.name}</span>
              <span className="text-xs text-gray-400 capitalize">({user?.role})</span>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="text-white hover:bg-red-500/20"
              data-testid="logout-btn"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-16 bottom-0 w-64 glass-effect border-r border-white/10 p-4 z-40 transform transition-transform lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`} data-testid="sidebar">
        <nav className="space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-white/5'
                }`}
                data-testid={`nav-${item.id}`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="pt-20 lg:pl-64">
        <div className="container mx-auto p-4 lg:p-8" data-testid="main-content">
          {user?.role === 'teacher' ? (
            <>
              {activeTab === 'teacher' && <TeacherDashboard />}
              {activeTab === 'classes' && <LiveClasses />}
            </>
          ) : (
            <>
              {activeTab === 'tutor' && <AITutor />}
              {activeTab === 'learning' && <Learning />}
              {activeTab === 'career' && <Career />}
              {activeTab === 'jobs' && <Jobs />}
              {activeTab === 'classes' && <LiveClasses />}
            </>
          )}
        </div>
      </main>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;