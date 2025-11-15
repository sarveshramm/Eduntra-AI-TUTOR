import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Briefcase, MapPin, DollarSign, Clock, Building, Star } from 'lucide-react';
import api from '../../utils/api';
import { toast } from 'sonner';

const Jobs = () => {
  const [jobs, setJobs] = useState([]);
  const [internships, setInternships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('jobs');
  const [jobsSource, setJobsSource] = useState('cached');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const [jobsRes, internshipsRes] = await Promise.all([
        api.get('/jobs?job_type=job'),
        api.get('/jobs?job_type=internship')
      ]);
      setJobs(jobsRes.data.jobs);
      setInternships(internshipsRes.data.jobs);
    } catch (error) {
      toast.error('Failed to fetch opportunities');
    } finally {
      setLoading(false);
    }
  };

  const getRecommendations = async () => {
    try {
      const response = await api.post('/jobs/recommend');
      toast.success('Showing personalized recommendations');
      setJobs(response.data.jobs.filter(j => j.type === 'job'));
      setInternships(response.data.jobs.filter(j => j.type === 'internship'));
    } catch (error) {
      toast.error('Failed to get recommendations');
    }
  };

  const JobCard = ({ job, index }) => (
    <Card className="glass-effect card-hover" data-testid={`job-${index}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-white text-xl mb-1">{job.title}</CardTitle>
            <div className="flex items-center gap-2 text-gray-400">
              <Building className="h-4 w-4" />
              <span>{job.company}</span>
            </div>
          </div>
          {job.match_score && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              <Star className="h-3 w-3 mr-1" />
              {job.match_score} Match
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <MapPin className="h-4 w-4 text-blue-400" />
            {job.location}
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <DollarSign className="h-4 w-4 text-green-400" />
            {job.salary}
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Clock className="h-4 w-4 text-purple-400" />
            {job.experience_level}
          </div>
        </div>

        <p className="text-gray-400 text-sm line-clamp-2">{job.description}</p>

        <div>
          <p className="text-sm text-gray-400 mb-2">Required Skills:</p>
          <div className="flex flex-wrap gap-2">
            {job.required_skills?.slice(0, 6).map((skill, i) => (
              <span key={i} className="skill-badge text-xs">
                {skill}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button className="flex-1 bg-gradient-to-r from-green-500 to-blue-500" data-testid={`apply-${index}`}>
            Apply Now
          </Button>
          <Button variant="outline" className="border-white/10 text-white" data-testid={`details-${index}`}>
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading opportunities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="jobs-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2" style={{fontFamily: 'Space Grotesk'}}>Jobs & Internships</h1>
          <p className="text-gray-400">Find opportunities that match your skills and interests</p>
        </div>
        <Button
          onClick={getRecommendations}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          data-testid="recommend-btn"
        >
          <Star className="h-5 w-5 mr-2" />
          Get Recommendations
        </Button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="glass-effect">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Full-time Jobs</p>
                <p className="text-3xl font-bold text-white">{jobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-effect">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <Clock className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Internships</p>
                <p className="text-3xl font-bold text-white">{internships.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-effect">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Star className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">New Today</p>
                <p className="text-3xl font-bold text-white">12</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" data-testid="jobs-tabs">
        <TabsList className="glass-effect w-full grid grid-cols-2">
          <TabsTrigger value="jobs" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500" data-testid="jobs-tab">
            <Briefcase className="h-4 w-4 mr-2" />
            Full-time Jobs ({jobs.length})
          </TabsTrigger>
          <TabsTrigger value="internships" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-blue-500" data-testid="internships-tab">
            <Clock className="h-4 w-4 mr-2" />
            Internships ({internships.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {jobs.map((job, index) => (
              <JobCard key={job.id} job={job} index={index} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="internships" className="mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {internships.map((job, index) => (
              <JobCard key={job.id} job={job} index={index} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Jobs;