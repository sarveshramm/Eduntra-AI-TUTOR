import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Mail, Lock, User, UserCircle, GraduationCap } from 'lucide-react';

const Register = ({ onToggle }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(name, email, password, role);
      navigate('/dashboard');
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md glass-effect" data-testid="register-card">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Join Eduntra AI
        </CardTitle>
        <CardDescription className="text-gray-300">
          Start your personalized learning journey today
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5" data-testid="register-form">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-200">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                data-testid="name-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-200">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="student@eduntra.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                data-testid="email-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-200">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                data-testid="password-input"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-gray-200">I am a</Label>
            <RadioGroup value={role} onValueChange={setRole} className="flex gap-4" data-testid="role-selector">
              <div className="flex items-center space-x-2 flex-1">
                <RadioGroupItem value="student" id="student" data-testid="role-student" />
                <Label htmlFor="student" className="flex items-center gap-2 cursor-pointer text-gray-200">
                  <GraduationCap className="h-5 w-5 text-blue-400" />
                  Student
                </Label>
              </div>
              <div className="flex items-center space-x-2 flex-1">
                <RadioGroupItem value="teacher" id="teacher" data-testid="role-teacher" />
                <Label htmlFor="teacher" className="flex items-center gap-2 cursor-pointer text-gray-200">
                  <UserCircle className="h-5 w-5 text-purple-400" />
                  Teacher
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-6 text-lg"
            disabled={loading}
            data-testid="register-button"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating Account...
              </span>
            ) : (
              'Create Account'
            )}
          </Button>

          <p className="text-center text-gray-400 text-sm">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onToggle}
              className="text-blue-400 hover:text-blue-300 font-semibold"
              data-testid="toggle-login"
            >
              Sign In
            </button>
          </p>
        </form>
      </CardContent>
    </Card>
  );
};

export default Register;