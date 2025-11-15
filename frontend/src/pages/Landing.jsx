import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowRight, BookOpen, Bot, Briefcase, Video, Globe, Zap, Users, Award } from 'lucide-react';
import AccessibleLogin from '../components/Auth/AccessibleLogin';
import Register from '../components/Auth/Register';

const Landing = () => {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const navigate = useNavigate();

  const features = [
    { icon: Bot, title: 'AI Tutor', description: 'Get instant help with personalized AI-powered tutoring' },
    { icon: BookOpen, title: 'Adaptive Learning', description: 'Customized learning paths based on your progress' },
    { icon: Briefcase, title: 'Career Guidance', description: 'Find your perfect career path with AI recommendations' },
    { icon: Video, title: 'Live Classes', description: 'Join interactive classes with expert teachers' },
    { icon: Globe, title: '19,000+ Languages', description: 'Learn in your native language' },
    { icon: Zap, title: 'Offline Mode', description: 'Learn anywhere, even without internet' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900" data-testid="landing-page">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white" style={{fontFamily: 'Space Grotesk'}}>Eduntra AI</span>
          </div>
          <Button
            onClick={() => setShowAuth(true)}
            className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-semibold px-6"
            data-testid="get-started-btn"
          >
            Get Started <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" data-testid="auth-modal">
          <div className="relative">
            <button
              onClick={() => setShowAuth(false)}
              className="absolute -top-4 -right-4 w-10 h-10 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white font-bold z-10"
              data-testid="close-auth-modal"
            >
              ×
            </button>
            {authMode === 'login' ? (
              <AccessibleLogin onToggle={() => setAuthMode('register')} />
            ) : (
              <Register onToggle={() => setAuthMode('login')} />
            )}
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="mb-6 inline-block px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm font-semibold">
            ✨ Future of Education is Here
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-white leading-tight" style={{fontFamily: 'Space Grotesk'}}>
            Learn Smarter with
            <span className="bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 bg-clip-text text-transparent"> AI-Powered Education</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-10 leading-relaxed">
            Personalized learning paths, AI tutoring, career guidance, and job opportunities - all in one platform designed for students worldwide
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => { setShowAuth(true); setAuthMode('register'); }}
              size="lg"
              className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white text-lg px-8 py-6 rounded-xl font-semibold"
              data-testid="start-learning-btn"
            >
              Start Learning Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-white/20 text-white hover:bg-white/10 text-lg px-8 py-6 rounded-xl font-semibold"
              data-testid="watch-demo-btn"
            >
              Watch Demo <Video className="ml-2 h-5 w-5" />
            </Button>
          </div>
          
          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div>
              <div className="text-4xl font-bold text-green-400">19K+</div>
              <div className="text-gray-400 text-sm">Languages</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-400">100%</div>
              <div className="text-gray-400 text-sm">Offline Ready</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-400">AI</div>
              <div className="text-gray-400 text-sm">Powered</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 bg-white/5">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4 text-white" style={{fontFamily: 'Space Grotesk'}}>Powerful Features</h2>
          <p className="text-center text-gray-400 mb-12 text-lg">Everything you need to succeed in your educational journey</p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="glass-effect p-6 rounded-2xl card-hover"
                  data-testid={`feature-${index}`}
                >
                  <div className="w-14 h-14 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-white">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="glass-effect p-12 rounded-3xl border border-white/10">
            <Users className="h-16 w-16 mx-auto mb-6 text-green-400" />
            <h2 className="text-4xl font-bold mb-4 text-white" style={{fontFamily: 'Space Grotesk'}}>Ready to Transform Your Learning?</h2>
            <p className="text-xl text-gray-300 mb-8">
              Join thousands of students already learning smarter with Eduntra AI
            </p>
            <Button
              onClick={() => { setShowAuth(true); setAuthMode('register'); }}
              size="lg"
              className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white text-lg px-10 py-6 rounded-xl font-semibold"
              data-testid="join-now-btn"
            >
              Join Now - It's Free! <Award className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10">
        <div className="container mx-auto text-center text-gray-400">
          <p>© 2025 Eduntra AI. Empowering education for everyone, everywhere.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;