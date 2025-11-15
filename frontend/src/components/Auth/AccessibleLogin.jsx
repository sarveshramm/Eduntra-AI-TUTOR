import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Mail, Lock, LogIn, Volume2, VolumeX, HelpCircle } from 'lucide-react';
import { voiceAccessibility } from '../../utils/voiceAccessibility';
import api from '../../utils/api';
import { toast } from 'sonner';

const AccessibleLogin = ({ onToggle }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (voiceEnabled) {
      announceLoginPage();
      voiceAccessibility.initVoiceCommands(handleVoiceCommand);
      voiceAccessibility.startListening();
    }
    
    return () => {
      voiceAccessibility.stopListening();
      voiceAccessibility.stopSpeaking();
    };
  }, [voiceEnabled]);

  const announceLoginPage = async () => {
    const announcement = `
      Welcome to Eduntra AI Login Page.
      You can log in by voice or by typing.
      
      For voice login, say 'enter email' followed by your email address,
      then say 'enter password' followed by your password.
      
      If you forgot your password, say 'forgot password'.
      
      To create a new account, say 'register' or 'sign up'.
      
      Say 'help' anytime for instructions.
    `;
    
    await voiceAccessibility.speak(announcement, 'page-announcement');
  };

  const handleVoiceCommand = async (command) => {
    if (command.type === 'help') {
      await voiceAccessibility.announceHelp();
    } else if (command.rawText && command.rawText.includes('forgot password')) {
      setShowForgotPassword(true);
      await voiceAccessibility.speak('Please say your registered email address', 'input-prompt');
    } else if (command.rawText && (command.rawText.includes('register') || command.rawText.includes('sign up'))) {
      onToggle();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    if (voiceEnabled) {
      await voiceAccessibility.speak('Logging in, please wait', 'status');
    }
    
    try {
      await login(email, password);
      
      if (voiceEnabled) {
        await voiceAccessibility.speak('Login successful! Redirecting to dashboard', 'success');
      }
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      
      if (voiceEnabled) {
        await voiceAccessibility.speak('Login failed. Please check your email and password', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast.error('Please enter your email');
      if (voiceEnabled) {
        await voiceAccessibility.speak('Please enter your email address', 'error');
      }
      return;
    }
    
    try {
      if (voiceEnabled) {
        await voiceAccessibility.speak('Sending password reset link', 'status');
      }
      
      const response = await api.post('/auth/forgot-password', { email: resetEmail });
      
      toast.success('Password reset link sent! Check your email');
      
      if (voiceEnabled) {
        await voiceAccessibility.speak(
          'Password reset link has been sent to your email. Please check your email and follow the instructions',
          'success'
        );
      }
      
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error) {
      toast.error('Failed to send reset link');
      
      if (voiceEnabled) {
        await voiceAccessibility.speak('Failed to send reset link. Please try again', 'error');
      }
    }
  };

  const toggleVoice = async () => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    
    if (newState) {
      await voiceAccessibility.speak('Voice accessibility enabled. You can now use voice commands', 'status');
    } else {
      voiceAccessibility.stopSpeaking();
      voiceAccessibility.stopListening();
    }
  };

  return (
    <Card className=\"w-full max-w-md glass-effect\" data-testid=\"login-card\">
      <CardHeader className=\"text-center\">
        <div className=\"flex items-center justify-between mb-4\">
          <CardTitle className=\"text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent\">
            Welcome Back
          </CardTitle>
          <Button
            type=\"button\"
            onClick={toggleVoice}
            variant=\"ghost\"
            size=\"icon\"
            className={voiceEnabled ? 'text-green-400' : 'text-gray-400'}
            title=\"Toggle Voice Accessibility\"
            data-testid=\"toggle-voice-btn\"
          >
            {voiceEnabled ? <Volume2 className=\"h-6 w-6\" /> : <VolumeX className=\"h-6 w-6\" />}
          </Button>
        </div>
        <CardDescription className=\"text-gray-300\">
          Sign in to continue your learning journey
        </CardDescription>
        {voiceEnabled && (
          <div className=\"bg-green-500/10 border border-green-500/20 rounded-lg p-3 mt-3\">
            <div className=\"flex items-center gap-2 text-green-400 text-sm\">
              <Volume2 className=\"h-4 w-4\" />
              Voice Accessibility Active
            </div>
            <p className=\"text-xs text-gray-400 mt-1\">
              Say 'help' for voice commands
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {showForgotPassword ? (
          <form onSubmit={handleForgotPassword} className=\"space-y-6\" data-testid=\"forgot-password-form\">
            <div>
              <h3 className=\"text-xl font-bold text-white mb-2\">Reset Password</h3>
              <p className=\"text-sm text-gray-400 mb-4\">
                Enter your email and we'll send you a reset link
              </p>
            </div>
            
            <div className=\"space-y-2\">
              <Label htmlFor=\"reset-email\" className=\"text-gray-200\">Email</Label>
              <div className=\"relative\">
                <Mail className=\"absolute left-3 top-3 h-5 w-5 text-gray-400\" />
                <Input
                  id=\"reset-email\"
                  type=\"email\"
                  placeholder=\"your@email.com\"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className=\"pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500\"
                  data-testid=\"reset-email-input\"
                  aria-label=\"Email address for password reset\"
                />
              </div>
            </div>

            <div className=\"flex gap-2\">
              <Button
                type=\"button\"
                variant=\"outline\"
                onClick={() => setShowForgotPassword(false)}
                className=\"flex-1 border-white/20\"
                data-testid=\"cancel-reset-btn\"
              >
                Cancel
              </Button>
              <Button
                type=\"submit\"
                className=\"flex-1 bg-gradient-to-r from-green-500 to-blue-500\"
                data-testid=\"send-reset-btn\"
              >
                Send Reset Link
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className=\"space-y-6\" data-testid=\"login-form\">
            <div className=\"space-y-2\">
              <Label htmlFor=\"email\" className=\"text-gray-200\">Email</Label>
              <div className=\"relative\">
                <Mail className=\"absolute left-3 top-3 h-5 w-5 text-gray-400\" />
                <Input
                  id=\"email\"
                  type=\"email\"
                  placeholder=\"student@eduntra.ai\"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className=\"pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500\"
                  data-testid=\"email-input\"
                  aria-label=\"Email address\"
                />
              </div>
            </div>

            <div className=\"space-y-2\">
              <div className=\"flex items-center justify-between\">
                <Label htmlFor=\"password\" className=\"text-gray-200\">Password</Label>
                <button
                  type=\"button\"
                  onClick={() => setShowForgotPassword(true)}
                  className=\"text-sm text-blue-400 hover:text-blue-300\"
                  data-testid=\"forgot-password-link\"
                >
                  Forgot Password?
                </button>
              </div>
              <div className=\"relative\">
                <Lock className=\"absolute left-3 top-3 h-5 w-5 text-gray-400\" />
                <Input
                  id=\"password\"
                  type=\"password\"
                  placeholder=\"••••••••\"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className=\"pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500\"
                  data-testid=\"password-input\"
                  aria-label=\"Password\"
                />
              </div>
            </div>

            <Button
              type=\"submit\"
              className=\"w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-6 text-lg\"
              disabled={loading}
              data-testid=\"login-button\"
            >
              {loading ? (
                <span className=\"flex items-center gap-2\">
                  <div className=\"w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin\" />
                  Signing in...
                </span>
              ) : (
                <span className=\"flex items-center gap-2\">
                  <LogIn className=\"h-5 w-5\" />
                  Sign In
                </span>
              )}
            </Button>

            <p className=\"text-center text-gray-400 text-sm\">
              Don't have an account?{' '}
              <button
                type=\"button\"
                onClick={onToggle}
                className=\"text-green-400 hover:text-green-300 font-semibold\"
                data-testid=\"toggle-register\"
              >
                Create Account
              </button>
            </p>
          </form>
        )}
        
        {voiceEnabled && (
          <div className=\"mt-6 pt-6 border-t border-white/10\">
            <div className=\"flex items-start gap-2 text-xs text-gray-400\">
              <HelpCircle className=\"h-4 w-4 flex-shrink-0 mt-0.5\" />
              <div>
                <p className=\"font-semibold text-gray-300 mb-1\">Voice Commands:</p>
                <ul className=\"space-y-1\">
                  <li>• Say \"forgot password\" to reset</li>
                  <li>• Say \"register\" to create account</li>
                  <li>• Say \"help\" for more commands</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AccessibleLogin;
