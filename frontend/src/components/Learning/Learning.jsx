import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { BookOpen, Plus, CheckCircle, Clock, TrendingUp, Target, Award, Zap, AlertCircle, ChevronRight, Brain } from 'lucide-react';
import Quiz from '../Quiz/Quiz';
import api from '../../utils/api';
import { toast } from 'sonner';
import { saveProgressOffline } from '../../utils/offlineStorage';

const Learning = () => {
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedPath, setSelectedPath] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizData, setQuizData] = useState({ pathId: null, phase: null, phaseTitle: '' });
  
  // RoadmapGPT questionnaire
  const [formData, setFormData] = useState({
    subject: '',
    skill_level: 'beginner',
    final_goal: '',
    daily_time: '1 hour',
    timeline: '4 weeks',
    roadmap_type: 'detailed'
  });

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
      const response = await api.post('/learning/create-path', formData);
      setPaths([...paths, response.data]);
      setShowCreate(false);
      setFormData({
        subject: '',
        skill_level: 'beginner',
        final_goal: '',
        daily_time: '1 hour',
        timeline: '4 weeks',
        roadmap_type: 'detailed'
      });
      toast.success('🎉 Roadmap created successfully!');
    } catch (error) {
      toast.error('Failed to create roadmap');
    } finally {
      setCreating(false);
    }
  };

  const startQuiz = (pathId, phase, phaseTitle) => {
    setQuizData({ pathId, phase, phaseTitle });
    setShowQuiz(true);
  };

  const handleQuizComplete = async () => {
    const { pathId, phase } = quizData;
    const path = paths.find(p => p.id === pathId);
    const totalPhases = path.lessons?.length || 1;
    const newProgress = Math.min(100, ((phase) / totalPhases) * 100);
    const completedPhases = Array.from({length: phase}, (_, i) => i + 1);
    
    try {
      await api.put(`/learning/progress/${pathId}`, { 
        progress: newProgress,
        completed_phases: completedPhases
      });
      await saveProgressOffline(pathId, newProgress);
      setPaths(paths.map(p => p.id === pathId ? { ...p, progress: newProgress, completed_phases: completedPhases } : p));
      setShowQuiz(false);
      toast.success('🎉 Phase completed! Moving to next phase...');
    } catch (error) {
      toast.error('Failed to update progress');
    }
  };

  const viewAnalytics = async (path) => {
    setSelectedPath(path);
    setLoadingAnalytics(true);
    setShowAnalytics(true);
    try {
      const response = await api.get(`/learning/analytics/${path.id}`);
      setAnalytics(response.data);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your roadmaps...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="learning-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2" style={{fontFamily: 'Space Grotesk'}}>🗺️ Learning Roadmaps</h1>
          <p className="text-gray-400">AI-powered personalized learning paths to mastery</p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
          data-testid="create-path-btn"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Roadmap
        </Button>
      </div>

      {/* Create Roadmap Modal - RoadmapGPT Style */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto" data-testid="create-modal">
          <Card className="w-full max-w-2xl glass-effect my-8">
            <CardHeader>
              <CardTitle className="text-white text-2xl">🎯 Create Your Custom Roadmap</CardTitle>
              <CardDescription className="text-gray-400">Answer these questions to get a personalized learning path</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createLearningPath} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-gray-200 text-base">1️⃣ What topic do you want a roadmap for?</Label>
                  <Input
                    id="subject"
                    placeholder="e.g., Python Programming, Web Development, Data Science"
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    required
                    className="bg-white/5 border-white/10 text-white text-base p-3"
                    data-testid="subject-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skill-level" className="text-gray-200 text-base">2️⃣ What is your current level?</Label>
                  <Select value={formData.skill_level} onValueChange={(val) => setFormData({...formData, skill_level: val})}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white p-3" data-testid="skill-level-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">🌱 Beginner - Just starting out</SelectItem>
                      <SelectItem value="intermediate">📈 Intermediate - Some experience</SelectItem>
                      <SelectItem value="advanced">🚀 Advanced - Strong foundation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="final_goal" className="text-gray-200 text-base">3️⃣ What is your final goal?</Label>
                  <Textarea
                    id="final_goal"
                    placeholder="e.g., Get a job as a developer, Build my own projects, Pass certification exam"
                    value={formData.final_goal}
                    onChange={(e) => setFormData({...formData, final_goal: e.target.value})}
                    required
                    className="bg-white/5 border-white/10 text-white text-base p-3"
                    data-testid="goal-input"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="daily_time" className="text-gray-200 text-base">4️⃣ Daily study time?</Label>
                    <Select value={formData.daily_time} onValueChange={(val) => setFormData({...formData, daily_time: val})}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white p-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30 minutes">⏰ 30 minutes</SelectItem>
                        <SelectItem value="1 hour">⏰ 1 hour</SelectItem>
                        <SelectItem value="2 hours">⏰ 2 hours</SelectItem>
                        <SelectItem value="3+ hours">⏰ 3+ hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeline" className="text-gray-200 text-base">5️⃣ Timeline?</Label>
                    <Select value={formData.timeline} onValueChange={(val) => setFormData({...formData, timeline: val})}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white p-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2 weeks">📅 2 weeks</SelectItem>
                        <SelectItem value="4 weeks">📅 4 weeks (Recommended)</SelectItem>
                        <SelectItem value="8 weeks">📅 8 weeks</SelectItem>
                        <SelectItem value="12 weeks">📅 12 weeks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="roadmap_type" className="text-gray-200 text-base">6️⃣ Roadmap detail level?</Label>
                  <Select value={formData.roadmap_type} onValueChange={(val) => setFormData({...formData, roadmap_type: val})}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white p-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">📝 Basic - Essential concepts only</SelectItem>
                      <SelectItem value="detailed">📚 Detailed - Comprehensive with projects (Recommended)</SelectItem>
                      <SelectItem value="advanced">🎓 Advanced - Expert-level deep dive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 border-white/20"
                    data-testid="cancel-btn"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={creating}
                    className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 text-base py-6"
                    data-testid="submit-path-btn"
                  >
                    {creating ? (
                      <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Generating...</>
                    ) : (
                      <>🚀 Generate My Roadmap</>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalytics && selectedPath && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-4xl glass-effect my-8">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-white text-2xl mb-2">📊 {selectedPath.subject} - Analytics</CardTitle>
                  <CardDescription className="text-gray-400">Detailed progress and performance metrics</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setShowAnalytics(false)}
                  className="text-white"
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAnalytics ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-400">Loading analytics...</p>
                </div>
              ) : analytics && (
                <div className="space-y-6">
                  {/* Progress Overview */}
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-5 w-5 text-blue-400" />
                        <span className="text-blue-400 text-sm font-semibold">Progress</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{analytics.progress?.percentage || 0}%</div>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                        <span className="text-green-400 text-sm font-semibold">Completed</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{analytics.progress?.completed_phases || 0}/{analytics.progress?.total_phases || 0}</div>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-5 w-5 text-purple-400" />
                        <span className="text-purple-400 text-sm font-semibold">Time Spent</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{analytics.time?.completed_hours || 0}h</div>
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-5 w-5 text-yellow-400" />
                        <span className="text-yellow-400 text-sm font-semibold">Streak</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{analytics.streak?.current_streak || 0} days</div>
                    </div>
                  </div>

                  {/* Phase Progress */}
                  <div>
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-blue-400" />
                      Phase Completion
                    </h4>
                    <div className="space-y-2">
                      {analytics.phases?.map((phase, idx) => (
                        <div key={idx} className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              phase.completed ? 'bg-green-500' : 'bg-gray-600'
                            }`}>
                              {phase.completed ? <CheckCircle className="h-5 w-5 text-white" /> : <span className="text-white text-sm">{phase.phase}</span>}
                            </div>
                            <span className="text-white font-medium">{phase.title}</span>
                          </div>
                          <span className="text-gray-400 text-sm">{phase.duration_minutes}min</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Milestones */}
                  <div>
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Award className="h-5 w-5 text-yellow-400" />
                      Milestones Achieved
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {analytics.milestones && Object.entries(analytics.milestones).map(([key, achieved]) => (
                        <div key={key} className={`rounded-lg p-3 text-center ${
                          achieved ? 'bg-green-500/20 border border-green-500/30' : 'bg-gray-500/10 border border-gray-500/20'
                        }`}>
                          <div className="text-2xl mb-1">{achieved ? '🏆' : '🔒'}</div>
                          <div className="text-xs text-gray-300">{key.replace('_', ' ')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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
                <p className="text-gray-400 text-sm">Active Roadmaps</p>
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
                  {paths.length > 0 ? Math.round(paths.reduce((acc, p) => acc + (p.progress || 0), 0) / paths.length) : 0}%
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
                  {paths.filter(p => (p.progress || 0) >= 100).length}
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
            <h3 className="text-2xl font-bold text-white mb-2">No Roadmaps Yet</h3>
            <p className="text-gray-400 mb-6">Create your first AI-powered learning roadmap to achieve your goals!</p>
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-gradient-to-r from-green-500 to-blue-500"
              data-testid="empty-create-btn"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create First Roadmap
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {paths.map((path, index) => (
            <Card key={path.id} className="glass-effect" data-testid={`path-${index}`}>
              <CardHeader>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <CardTitle className="text-white text-2xl mb-2">{path.subject}</CardTitle>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Target className="h-4 w-4" />
                        {path.skill_level}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {path.timeline}
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        {path.lessons?.length || 0} phases
                      </span>
                    </div>
                    {path.final_goal && (
                      <p className="text-gray-400 text-sm mt-2">🎯 Goal: {path.final_goal}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-400">{path.progress || 0}%</div>
                    <div className="text-xs text-gray-400">Complete</div>
                  </div>
                </div>
                <Progress value={path.progress || 0} className="h-2" />
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Roadmap Phases */}
                <div className="space-y-3">
                  {path.lessons && path.lessons.map((lesson, lessonIdx) => {
                    const isCompleted = path.completed_phases?.includes(lesson.phase) || false;
                    const isCurrent = !isCompleted && lessonIdx === (path.completed_phases?.length || 0);
                    
                    return (
                      <div
                        key={lessonIdx}
                        className={`bg-white/5 rounded-xl p-5 border-l-4 transition-all ${
                          isCompleted ? 'border-green-500' : isCurrent ? 'border-blue-500' : 'border-gray-600'
                        }`}
                      >
                        <div className="flex items-start gap-4 mb-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isCompleted ? 'bg-green-500' : isCurrent ? 'bg-blue-500' : 'bg-gray-600'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle className="h-6 w-6 text-white" />
                            ) : (
                              <span className="text-white font-bold">Phase {lesson.phase}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="text-white font-bold text-lg">{lesson.title}</h5>
                              <span className="text-gray-400 text-sm">{lesson.duration}</span>
                            </div>
                            <p className="text-gray-400 text-sm mb-3">{lesson.description}</p>
                            
                            {/* Objectives */}
                            {lesson.objectives && (
                              <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-1">📋 OBJECTIVES:</p>
                                <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                                  {lesson.objectives.slice(0, 3).map((obj, i) => (
                                    <li key={i}>{obj}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Topics */}
                            {lesson.topics && (
                              <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-2">📚 KEY TOPICS:</p>
                                <div className="flex flex-wrap gap-2">
                                  {lesson.topics.map((topic, i) => (
                                    <span key={i} className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full">
                                      {topic}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Practice */}
                            {lesson.practice && (
                              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 mb-3">
                                <p className="text-xs text-purple-400 mb-1">💪 PRACTICE:</p>
                                <p className="text-sm text-purple-300">{lesson.practice}</p>
                              </div>
                            )}
                            
                            {/* Resources & Tools */}
                            <div className="grid md:grid-cols-2 gap-3 mb-3">
                              {lesson.resources && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">🔗 RESOURCES:</p>
                                  <ul className="text-xs text-gray-400 space-y-1">
                                    {lesson.resources.slice(0, 3).map((res, i) => (
                                      <li key={i}>• {res}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {lesson.tools && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">🛠️ TOOLS:</p>
                                  <ul className="text-xs text-gray-400 space-y-1">
                                    {lesson.tools.slice(0, 3).map((tool, i) => (
                                      <li key={i}>• {tool}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            
                            {/* Common Mistakes */}
                            {lesson.common_mistakes && (
                              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-3">
                                <p className="text-xs text-red-400 mb-1">⚠️ COMMON MISTAKES:</p>
                                <ul className="text-xs text-red-300 space-y-1">
                                  {lesson.common_mistakes.slice(0, 2).map((mistake, i) => (
                                    <li key={i}>• {mistake}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Success Metrics */}
                            {lesson.success_metrics && (
                              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                                <p className="text-xs text-green-400 mb-1">✅ SUCCESS METRICS:</p>
                                <ul className="text-xs text-green-300 space-y-1">
                                  {lesson.success_metrics.slice(0, 2).map((metric, i) => (
                                    <li key={i}>• {metric}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {!isCompleted && (
                          <Button
                            onClick={() => updateProgress(path.id, lessonIdx)}
                            className="w-full mt-3 bg-gradient-to-r from-green-500 to-blue-500"
                            data-testid={`complete-phase-${index}-${lessonIdx}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark Phase {lesson.phase} Complete
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Final Checklist */}
                {path.final_checklist && path.final_checklist.length > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5">
                    <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                      <Award className="h-5 w-5 text-yellow-400" />
                      🏆 Final Mastery Checklist
                    </h4>
                    <ul className="space-y-2">
                      {path.final_checklist.map((item, i) => (
                        <li key={i} className="text-gray-300 text-sm">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Next Steps */}
                {path.next_steps && path.next_steps.length > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
                    <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                      <ChevronRight className="h-5 w-5 text-blue-400" />
                      🚀 What's Next?
                    </h4>
                    <ul className="space-y-2">
                      {path.next_steps.map((step, i) => (
                        <li key={i} className="text-gray-300 text-sm">• {step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => viewAnalytics(path)}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500"
                    data-testid={`analytics-btn-${index}`}
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