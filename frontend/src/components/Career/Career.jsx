import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Briefcase, TrendingUp, DollarSign, MapPin, Book, Sparkles } from 'lucide-react';
import api from '../../utils/api';
import { toast } from 'sonner';

const Career = () => {
  const [careers, setCareers] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [interests, setInterests] = useState([]);
  const [skills, setSkills] = useState([]);
  const [newInterest, setNewInterest] = useState('');
  const [newSkill, setNewSkill] = useState('');

  const analyzeCareers = async () => {
    if (interests.length === 0 || skills.length === 0) {
      toast.error('Please add at least one interest and one skill');
      return;
    }

    setAnalyzing(true);
    try {
      const response = await api.post('/career/analyze', { interests, skills });
      setCareers(response.data.careers);
      toast.success('Career analysis complete!');
    } catch (error) {
      toast.error('Failed to analyze careers');
    } finally {
      setAnalyzing(false);
    }
  };

  const addInterest = () => {
    if (newInterest.trim()) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const addSkill = () => {
    if (newSkill.trim()) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  return (
    <div className="space-y-6" data-testid="career-page">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2" style={{fontFamily: 'Space Grotesk'}}>Career Path Finder</h1>
        <p className="text-gray-400">Discover your perfect career with AI-powered recommendations</p>
      </div>

      {/* Input Section */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="glass-effect">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              My Interests
            </CardTitle>
            <CardDescription className="text-gray-400">What are you passionate about?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addInterest()}
                placeholder="e.g., Technology, Art, Science"
                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-500"
                data-testid="interest-input"
              />
              <Button onClick={addInterest} className="bg-green-500 hover:bg-green-600" data-testid="add-interest-btn">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {interests.map((interest, i) => (
                <Badge key={i} className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30" data-testid={`interest-${i}`}>
                  {interest}
                  <button onClick={() => setInterests(interests.filter((_, idx) => idx !== i))} className="ml-2">×</button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-effect">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-400" />
              My Skills
            </CardTitle>
            <CardDescription className="text-gray-400">What are you good at?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                placeholder="e.g., Programming, Design, Writing"
                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-500"
                data-testid="skill-input"
              />
              <Button onClick={addSkill} className="bg-blue-500 hover:bg-blue-600" data-testid="add-skill-btn">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, i) => (
                <Badge key={i} className="bg-blue-500/20 text-blue-400 border-blue-500/30" data-testid={`skill-${i}`}>
                  {skill}
                  <button onClick={() => setSkills(skills.filter((_, idx) => idx !== i))} className="ml-2">×</button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analyze Button */}
      <div className="text-center">
        <Button
          onClick={analyzeCareers}
          disabled={analyzing}
          size="lg"
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-lg px-8 py-6"
          data-testid="analyze-btn"
        >
          {analyzing ? (
            <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Analyzing...</>
          ) : (
            <><Briefcase className="mr-2 h-5 w-5" /> Find My Career Paths</>
          )}
        </Button>
      </div>

      {/* Career Results */}
      {careers.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Recommended Career Paths</h2>
          <div className="grid lg:grid-cols-2 gap-6">
            {careers.map((career, index) => (
              <Card key={index} className="glass-effect card-hover" data-testid={`career-${index}`}>
                <CardHeader>
                  <CardTitle className="text-white text-xl">{career.title}</CardTitle>
                  <CardDescription className="text-gray-400 line-clamp-2">{career.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-green-400">
                    <DollarSign className="h-5 w-5" />
                    <span className="font-semibold">{career.salary_range}</span>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Required Skills:</p>
                    <div className="flex flex-wrap gap-2">
                      {career.required_skills?.slice(0, 5).map((skill, i) => (
                        <span key={i} className="skill-badge">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {career.roadmap && career.roadmap.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-400 mb-2">Learning Roadmap:</p>
                      <ul className="space-y-1">
                        {career.roadmap.slice(0, 3).map((step, i) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                            <Book className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button className="w-full bg-gradient-to-r from-green-500 to-blue-500" data-testid={`explore-${index}`}>
                    Explore This Career
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Career;