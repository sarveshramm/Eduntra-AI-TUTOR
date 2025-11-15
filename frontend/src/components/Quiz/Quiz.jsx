import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Progress } from '../ui/progress';
import { CheckCircle, XCircle, Award, TrendingUp, AlertCircle, Lightbulb } from 'lucide-react';
import api from '../../utils/api';
import { toast } from 'sonner';

const Quiz = ({ pathId, phase, phaseTitle, onComplete, onClose }) => {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    generateQuiz();
  }, []);

  const generateQuiz = async () => {
    setLoading(true);
    try {
      const response = await api.post(`/learning/generate-quiz/${pathId}/${phase}`);
      setQuiz(response.data);
      setSelectedAnswers(new Array(response.data.questions.length).fill(null));
      toast.success('🎯 Quiz generated! Good luck!');
    } catch (error) {
      toast.error('Failed to generate quiz');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answerIndex) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestion] = ['A', 'B', 'C', 'D'][answerIndex];
    setSelectedAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = async () => {
    // Check if all questions answered
    if (selectedAnswers.includes(null)) {
      toast.error('Please answer all questions before submitting');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post(`/learning/submit-quiz/${quiz.id}`, {
        answers: selectedAnswers
      });
      setResults(response.data);
      setShowResults(true);
      
      if (response.data.passed) {
        toast.success(`🎉 Congratulations! You scored ${response.data.percentage}%`);
      } else {
        toast.info(`You scored ${response.data.percentage}%. Review and try again!`);
      }
    } catch (error) {
      toast.error('Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = () => {
    if (results && results.passed) {
      onComplete();
    }
    onClose();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <Card className="w-full max-w-3xl glass-effect">
          <CardContent className="py-20 text-center">
            <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="text-white text-xl">Generating your personalized quiz...</p>
            <p className="text-gray-400 mt-2">AI is creating questions based on what you learned</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
        <Card className="w-full max-w-4xl glass-effect my-8">
          <CardHeader>
            <div className="text-center">
              <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 ${
                results.passed ? 'bg-green-500/20' : 'bg-yellow-500/20'
              }`}>
                {results.passed ? (
                  <Award className="h-12 w-12 text-green-400" />
                ) : (
                  <TrendingUp className="h-12 w-12 text-yellow-400" />
                )}
              </div>
              <CardTitle className="text-white text-3xl mb-2">
                {results.passed ? '🎉 Quiz Passed!' : '📚 Keep Learning!'}
              </CardTitle>
              <CardDescription className="text-gray-300 text-lg">
                You scored {results.score} out of {results.total_questions} ({results.percentage}%)
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Score Summary */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-400">{results.score}</div>
                <div className="text-sm text-gray-400">Correct Answers</div>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-400">{results.percentage}%</div>
                <div className="text-sm text-gray-400">Score</div>
              </div>
              <div className={`${
                results.passed ? 'bg-green-500/10 border-green-500/20' : 'bg-yellow-500/10 border-yellow-500/20'
              } border rounded-lg p-4 text-center`}>
                <div className={`text-3xl font-bold ${results.passed ? 'text-green-400' : 'text-yellow-400'}`}>
                  {results.passed ? 'PASS' : 'RETRY'}
                </div>
                <div className="text-sm text-gray-400">Status</div>
              </div>
            </div>

            {/* Question Review */}
            <div>
              <h4 className="text-white font-bold mb-4 text-xl">📝 Question Review</h4>
              <div className="space-y-4">
                {results.results.map((result, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl p-5 border-l-4 ${
                      result.is_correct 
                        ? 'bg-green-500/10 border-green-500' 
                        : 'bg-red-500/10 border-red-500'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        result.is_correct ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {result.is_correct ? (
                          <CheckCircle className="h-5 w-5 text-white" />
                        ) : (
                          <XCircle className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h5 className="text-white font-semibold mb-2">Question {idx + 1}</h5>
                        <p className="text-gray-300 mb-3">{result.question}</p>
                        
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">Your answer:</span>
                            <span className={`font-semibold ${
                              result.is_correct ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {result.user_answer || 'Not answered'}
                            </span>
                          </div>
                          {!result.is_correct && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-400">Correct answer:</span>
                              <span className="font-semibold text-green-400">{result.correct_answer}</span>
                            </div>
                          )}
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <Lightbulb className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-blue-400 font-semibold mb-1">Explanation:</p>
                              <p className="text-sm text-blue-300">{result.explanation}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {results.passed ? (
                <Button
                  onClick={handleFinish}
                  className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 py-6 text-lg"
                  data-testid="finish-quiz-btn"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Complete Phase & Continue
                </Button>
              ) : (
                <>
                  <Button
                    onClick={onClose}
                    variant="outline"
                    className="flex-1 border-white/20 py-6"
                    data-testid="close-quiz-btn"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => { setShowResults(false); generateQuiz(); }}
                    className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 py-6 text-lg"
                    data-testid="retry-quiz-btn"
                  >
                    <TrendingUp className="h-5 w-5 mr-2" />
                    Try Again
                  </Button>
                </>
              )}
            </div>

            {!results.passed && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
                <AlertCircle className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
                <p className="text-sm text-yellow-300">
                  You need 70% or higher to pass this phase. Review the explanations and try again!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const question = quiz?.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz?.questions.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <Card className="w-full max-w-3xl glass-effect">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-white text-2xl">📝 {quiz?.title}</CardTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Question {currentQuestion + 1} of {quiz?.questions.length}</span>
              <span className="text-gray-400">{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Question */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-white text-xl font-semibold mb-6">{question?.question}</h3>
            
            <div className="space-y-3">
              {question?.options.map((option, idx) => {
                const optionLetter = ['A', 'B', 'C', 'D'][idx];
                const isSelected = selectedAnswers[currentQuestion] === optionLetter;
                
                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswerSelect(idx)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'bg-green-500/20 border-green-500 shadow-lg'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                    data-testid={`option-${idx}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        isSelected ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-400'
                      }`}>
                        {optionLetter}
                      </div>
                      <span className="text-white">{option}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <Button
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              variant="outline"
              className="border-white/20"
              data-testid="prev-btn"
            >
              Previous
            </Button>
            
            <div className="flex-1" />
            
            {currentQuestion === quiz?.questions.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={submitting || selectedAnswers.includes(null)}
                className="bg-gradient-to-r from-green-500 to-blue-500 px-8"
                data-testid="submit-quiz-btn"
              >
                {submitting ? 'Submitting...' : 'Submit Quiz'}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={selectedAnswers[currentQuestion] === null}
                className="bg-gradient-to-r from-blue-500 to-purple-500"
                data-testid="next-btn"
              >
                Next Question
              </Button>
            )}
          </div>

          {/* Answer Status */}
          <div className="flex items-center justify-center gap-2">
            {quiz?.questions.map((_, idx) => (
              <div
                key={idx}
                className={`w-8 h-2 rounded-full ${
                  selectedAnswers[idx] !== null
                    ? 'bg-green-500'
                    : idx === currentQuestion
                    ? 'bg-blue-500'
                    : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Quiz;
