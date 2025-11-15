import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { BookOpen, Plus, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import api from '../../utils/api';
import { toast } from 'sonner';
import { saveProgressOffline } from '../../utils/offlineStorage';

const Learning = () => {
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState('');
  const [skillLevel, setSkillLevel] = useState('beginner');

  useEffect(() => {
    fetchLearningPaths();
  }, []);

  const fetchLearningPaths = async () => {
    try {
      const response = await api.get('/learning/my-paths');
      setPaths(response.data.paths);
    } catch (error) {
      console.error('Failed to fetch paths:', error);
    } finally {
      setLoading(false);
    }
  };

  const createLearningPath = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await api.post('/learning/create-path', {
        subject,
        skill_level: skillLevel
      });
      setPaths([...paths, response.data]);
      setShowCreate(false);
      setSubject('');
      toast.success('Learning path created!');
    } catch (error) {
      toast.error('Failed to create learning path');
    } finally {
      setCreating(false);
    }
  };

  const updateProgress = async (pathId, newProgress) => {
    try {
      await api.put(`/learning/progress/${pathId}`, { progress: newProgress });
      await saveProgressOffline(pathId, newProgress);
      setPaths(paths.map(p => p.id === pathId ? { ...p, progress: newProgress } : p));
      toast.success('Progress updated!');
    } catch (error) {
      toast.error('Failed to update progress');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your learning paths...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="learning-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2" style={{fontFamily: 'Space Grotesk'}}>My Learning Paths</h1>
          <p className="text-gray-400">Personalized learning journeys tailored for you</p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
          data-testid="create-path-btn"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Path
        </Button>
      </div>

      {/* Create Path Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" data-testid="create-modal">
          <Card className="w-full max-w-md glass-effect">
            <CardHeader>
              <CardTitle className="text-white">Create Learning Path</CardTitle>
              <CardDescription className="text-gray-400">AI will generate a personalized curriculum for you</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createLearningPath} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-gray-200">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="e.g., Python Programming, Mathematics, Physics"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    className="bg-white/5 border-white/10 text-white"
                    data-testid="subject-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="skill-level" className="text-gray-200">Skill Level</Label>
                  <Select value={skillLevel} onValueChange={setSkillLevel}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="skill-level-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreate(false)}
                    className="flex-1"
                    data-testid="cancel-btn"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={creating}
                    className="flex-1 bg-gradient-to-r from-green-500 to-blue-500"
                    data-testid="submit-path-btn"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="glass-effect">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Active Paths</p>
                <p className="text-3xl font-bold text-white">{paths.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-effect">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Avg Progress</p>
                <p className="text-3xl font-bold text-white">
                  {paths.length > 0 ? Math.round(paths.reduce((acc, p) => acc + p.progress, 0) / paths.length) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-effect">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Completed</p>
                <p className="text-3xl font-bold text-white">
                  {paths.filter(p => p.progress >= 100).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Learning Paths */}
      {paths.length === 0 ? (
        <Card className="glass-effect">
          <CardContent className="py-20 text-center">
            <BookOpen className="h-20 w-20 mx-auto mb-6 text-gray-400" />
            <h3 className="text-2xl font-bold text-white mb-2">No Learning Paths Yet</h3>
            <p className="text-gray-400 mb-6">Create your first personalized learning path to get started!</p>
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-gradient-to-r from-green-500 to-blue-500"
              data-testid="empty-create-btn"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create First Path
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {paths.map((path, index) => (
            <Card key={path.id} className="glass-effect" data-testid={`path-${index}`}>
              <CardHeader>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <CardTitle className="text-white text-2xl mb-1">{path.subject}</CardTitle>
                    <CardDescription className="text-gray-400">
                      {path.lessons?.length || 0} lessons • Estimated 4 weeks
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-400">{path.progress}%</div>
                    <div className="text-xs text-gray-400">Complete</div>
                  </div>
                </div>
                <Progress value={path.progress} className="h-2" />
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Roadmap Timeline */}
                <div>
                  <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-400" />
                    Learning Roadmap
                  </h4>
                  <div className="space-y-3">
                    {path.lessons && path.lessons.map((lesson, lessonIdx) => {
                      const isCompleted = (lessonIdx + 1) * (100 / path.lessons.length) <= path.progress;
                      return (
                        <div
                          key={lessonIdx}
                          className={`bg-white/5 rounded-lg p-4 border-l-4 transition-all ${
                            isCompleted ? 'border-green-500' : 'border-gray-600'
                          }`}
                          data-testid={`lesson-${index}-${lessonIdx}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isCompleted ? 'bg-green-500' : 'bg-gray-600'
                              }`}>
                                {isCompleted ? (
                                  <CheckCircle className="h-5 w-5 text-white" />
                                ) : (
                                  <span className="text-white text-sm font-bold">{lessonIdx + 1}</span>
                                )}
                              </div>
                              <div className="flex-1">
                                <h5 className="text-white font-semibold">{lesson.title}</h5>
                                <p className="text-gray-400 text-sm mt-1">{lesson.description}</p>
                                
                                {/* Topics */}
                                {lesson.topics && lesson.topics.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {lesson.topics.slice(0, 3).map((topic, topicIdx) => (
                                      <span key={topicIdx} className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md">
                                        {topic}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-xs text-gray-400">{lesson.week || `Week ${Math.ceil((lessonIdx + 1) / 2)}`}</div>
                              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                                <Clock className="h-3 w-3" />
                                {lesson.duration_minutes || 45}min
                              </div>
                            </div>
                          </div>
                          
                          {/* Practice Activity */}
                          {lesson.practice && (
                            <div className="mt-3 bg-purple-500/10 border border-purple-500/20 rounded-md p-2">
                              <p className="text-xs text-purple-300">
                                <strong>Practice:</strong> {lesson.practice}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => updateProgress(path.id, Math.min(100, path.progress + 10))}
                    className="flex-1 bg-gradient-to-r from-green-500 to-blue-500"
                    data-testid={`progress-btn-${index}`}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Lesson Complete
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 text-white"
                    data-testid={`view-btn-${index}`}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    View Analytics
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Learning;