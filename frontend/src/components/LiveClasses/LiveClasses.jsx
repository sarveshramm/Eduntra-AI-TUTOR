import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Video, Calendar, Clock, Users, Play, Plus, User } from 'lucide-react';
import api from '../../utils/api';
import { toast } from 'sonner';

const LiveClasses = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduled_time: '',
    duration_minutes: 60
  });

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await api.get('/classes/schedule');
      setClasses(response.data.classes);
    } catch (error) {
      console.error('Failed to fetch classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const createClass = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/classes/create', formData);
      setClasses([...classes, response.data]);
      setShowCreate(false);
      setFormData({ title: '', description: '', scheduled_time: '', duration_minutes: 60 });
      toast.success('Class created successfully!');
    } catch (error) {
      toast.error('Failed to create class');
    }
  };

  const joinClass = async (classId) => {
    try {
      await api.post(`/classes/${classId}/join`);
      toast.success('Successfully joined the class!');
      fetchClasses();
    } catch (error) {
      toast.error('Failed to join class');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading classes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="live-classes">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2" style={{fontFamily: 'Space Grotesk'}}>Live Classes</h1>
          <p className="text-gray-400">Interactive learning with expert teachers</p>
        </div>
        {user?.role === 'teacher' && (
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600"
            data-testid="create-class-btn"
          >
            <Plus className="h-5 w-5 mr-2" />
            Schedule Class
          </Button>
        )}
      </div>

      {/* Create Class Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" data-testid="create-class-modal">
          <Card className="w-full max-w-md glass-effect">
            <CardHeader>
              <CardTitle className="text-white">Schedule New Class</CardTitle>
              <CardDescription className="text-gray-400">Create a live session for your students</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createClass} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-gray-200">Class Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    className="bg-white/5 border-white/10 text-white"
                    data-testid="class-title-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-gray-200">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    required
                    className="bg-white/5 border-white/10 text-white"
                    data-testid="class-description-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduled_time" className="text-gray-200">Scheduled Time</Label>
                  <Input
                    id="scheduled_time"
                    type="datetime-local"
                    value={formData.scheduled_time}
                    onChange={(e) => setFormData({...formData, scheduled_time: e.target.value})}
                    required
                    className="bg-white/5 border-white/10 text-white"
                    data-testid="class-time-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration" className="text-gray-200">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value)})}
                    min="15"
                    max="180"
                    required
                    className="bg-white/5 border-white/10 text-white"
                    data-testid="class-duration-input"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreate(false)}
                    className="flex-1"
                    data-testid="cancel-class-btn"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-red-500 to-pink-500"
                    data-testid="submit-class-btn"
                  >
                    Schedule
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Classes Grid */}
      {classes.length === 0 ? (
        <Card className="glass-effect">
          <CardContent className="py-20 text-center">
            <Video className="h-20 w-20 mx-auto mb-6 text-gray-400" />
            <h3 className="text-2xl font-bold text-white mb-2">No Scheduled Classes</h3>
            <p className="text-gray-400 mb-6">
              {user?.role === 'teacher' 
                ? 'Create your first live class to start teaching!'
                : 'Check back later for upcoming live classes'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {classes.map((classItem, index) => {
            const scheduledDate = new Date(classItem.scheduled_time);
            const isUpcoming = scheduledDate > new Date();
            
            return (
              <Card key={classItem.id} className="glass-effect card-hover" data-testid={`class-${index}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-white text-xl mb-2">{classItem.title}</CardTitle>
                      <CardDescription className="text-gray-400">{classItem.description}</CardDescription>
                    </div>
                    <Badge className={isUpcoming ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                      {classItem.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-300">
                      <Calendar className="h-4 w-4 text-blue-400" />
                      {scheduledDate.toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Clock className="h-4 w-4 text-purple-400" />
                      {scheduledDate.toLocaleTimeString()}
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Users className="h-4 w-4 text-green-400" />
                      {classItem.students?.length || 0} students
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Clock className="h-4 w-4 text-orange-400" />
                      {classItem.duration_minutes} mins
                    </div>
                  </div>

                  {user?.role === 'student' && isUpcoming && (
                    <Button
                      onClick={() => joinClass(classItem.id)}
                      className="w-full bg-gradient-to-r from-green-500 to-blue-500"
                      data-testid={`join-class-${index}`}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Join Class
                    </Button>
                  )}

                  {user?.role === 'teacher' && (
                    <Button
                      className="w-full bg-gradient-to-r from-red-500 to-pink-500"
                      data-testid={`start-class-${index}`}
                    >
                      <Video className="h-4 w-4 mr-2" />
                      Start Class
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LiveClasses;