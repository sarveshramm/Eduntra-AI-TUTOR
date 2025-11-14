import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Users, TrendingUp, BookOpen, Award, ChevronRight } from 'lucide-react';
import api from '../../utils/api';
import { toast } from 'sonner';

const TeacherDashboard = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const response = await api.get('/teacher/students');
      setStudents(response.data.students);
    } catch (error) {
      toast.error('Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async (studentId) => {
    try {
      const response = await api.get(`/teacher/analytics/${studentId}`);
      setAnalytics(response.data);
      setSelectedStudent(studentId);
    } catch (error) {
      toast.error('Failed to fetch analytics');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="teacher-dashboard">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2" style={{fontFamily: 'Space Grotesk'}}>Teacher Dashboard</h1>
        <p className="text-gray-400">Monitor student progress and performance</p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6">
        <Card className="glass-effect">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Students</p>
                <p className="text-3xl font-bold text-white">{students.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-effect">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Active Learners</p>
                <p className="text-3xl font-bold text-white">{Math.floor(students.length * 0.75)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-effect">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Learning Paths</p>
                <p className="text-3xl font-bold text-white">{analytics?.learning_paths || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-effect">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <Award className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Avg Progress</p>
                <p className="text-3xl font-bold text-white">{analytics?.average_progress?.toFixed(0) || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students List */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="glass-effect">
            <CardHeader>
              <CardTitle className="text-white">Students</CardTitle>
              <CardDescription className="text-gray-400">Click to view analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {students.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No students yet</p>
                ) : (
                  students.map((student, index) => (
                    <button
                      key={student.id}
                      onClick={() => fetchAnalytics(student.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                        selectedStudent === student.id
                          ? 'bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/30'
                          : 'bg-white/5 hover:bg-white/10'
                      }`}
                      data-testid={`student-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                          {student.name.charAt(0)}
                        </div>
                        <div className="text-left">
                          <p className="text-white font-medium">{student.name}</p>
                          <p className="text-xs text-gray-400">{student.email}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics */}
        <div className="lg:col-span-2">
          {analytics ? (
            <div className="space-y-6">
              <Card className="glass-effect">
                <CardHeader>
                  <CardTitle className="text-white">Student Analytics</CardTitle>
                  <CardDescription className="text-gray-400">Performance overview</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <p className="text-blue-400 font-bold text-3xl">{analytics.learning_paths}</p>
                      <p className="text-gray-400 text-sm">Learning Paths</p>
                    </div>
                    <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                      <p className="text-green-400 font-bold text-3xl">{analytics.total_lessons}</p>
                      <p className="text-gray-400 text-sm">Total Lessons</p>
                    </div>
                    <div className="text-center p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <p className="text-purple-400 font-bold text-3xl">{Math.round(analytics.average_progress)}%</p>
                      <p className="text-gray-400 text-sm">Avg Progress</p>
                    </div>
                  </div>

                  {analytics.paths && analytics.paths.length > 0 && (
                    <div>
                      <h4 className="text-white font-semibold mb-3">Active Learning Paths</h4>
                      <div className="space-y-3">
                        {analytics.paths.map((path, index) => (
                          <div key={path.id} className="bg-white/5 p-4 rounded-lg" data-testid={`path-${index}`}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-white font-medium">{path.subject}</p>
                              <span className="text-green-400 font-bold">{path.progress}%</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all"
                                style={{ width: `${path.progress}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-effect">
                <CardHeader>
                  <CardTitle className="text-white">Actions</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-3">
                  <Button className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500" data-testid="assign-quiz-btn">
                    Assign Quiz
                  </Button>
                  <Button className="flex-1 bg-gradient-to-r from-green-500 to-blue-500" data-testid="send-message-btn">
                    Send Message
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="glass-effect">
              <CardContent className="py-20 text-center">
                <Users className="h-20 w-20 mx-auto mb-6 text-gray-400" />
                <h3 className="text-2xl font-bold text-white mb-2">Select a Student</h3>
                <p className="text-gray-400">Choose a student from the list to view their analytics</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;