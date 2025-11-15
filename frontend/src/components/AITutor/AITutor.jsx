import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Mic, Send, Volume2, Loader2, Bot, User, History, Plus, MessageSquare } from 'lucide-react';
import api from '../../utils/api';
import { toast } from 'sonner';
import { saveChatOffline } from '../../utils/offlineStorage';
import Lottie from 'lottie-react';

const AITutor = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [sessionId, setSessionId] = useState(`session_${Date.now()}`);
  const [showInfo, setShowInfo] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const silenceTimerRef = useRef(null);

  // Initialize Speech Recognition with continuous mode support
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true; // Enable continuous listening
      recognitionRef.current.interimResults = true; // Get interim results for better UX

      recognitionRef.current.onresult = (event) => {
        const results = event.results;
        const lastResult = results[results.length - 1];
        const transcript = lastResult[0].transcript;
        
        // Only process final results
        if (lastResult.isFinal) {
          setInput(transcript);
          
          // If in voice mode, automatically send the message
          if (voiceMode) {
            setIsListening(false);
            // Small delay to ensure state updates
            setTimeout(() => {
              sendVoiceMessage(transcript);
            }, 100);
          } else {
            setIsListening(false);
          }
        } else {
          // Show interim results in real-time
          setInput(transcript);
        }
        
        // Reset silence timer on speech
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        
        // Set new silence timer (2 seconds of silence = stop listening)
        silenceTimerRef.current = setTimeout(() => {
          if (voiceMode && isListening) {
            recognitionRef.current?.stop();
          }
        }, 2000);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        // Don't show error for normal stops
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          toast.error('Voice recognition error: ' + event.error);
        }
        
        // Restart listening in voice mode if error occurred
        if (voiceMode && event.error === 'no-speech') {
          setTimeout(() => startListening(), 500);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        
        // Auto-restart listening in voice mode if not speaking
        if (voiceMode && !isSpeaking && !loading) {
          setTimeout(() => startListening(), 300);
        }
      };
    }
    
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [voiceMode, isSpeaking, loading]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history on mount
  useEffect(() => {
    loadChatSessions();
  }, []);

  const loadChatSessions = async () => {
    try {
      const response = await api.get('/tutor/sessions');
      setChatSessions(response.data.sessions || []);
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    }
  };

  const loadSession = async (sessionIdToLoad) => {
    setLoadingHistory(true);
    try {
      const response = await api.get(`/tutor/history/${sessionIdToLoad}`);
      setMessages(response.data.messages || []);
      setSessionId(sessionIdToLoad);
      setShowHistory(false);
      toast.success('Chat history loaded!');
    } catch (error) {
      toast.error('Failed to load chat history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const startNewChat = () => {
    const newSessionId = `session_${Date.now()}`;
    setSessionId(newSessionId);
    setMessages([]);
    setShowHistory(false);
    toast.success('Started new conversation!');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop listening
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
      // Stop speaking
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      // Clear timers
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  const startListening = () => {
    if (!recognitionRef.current) {
      toast.error('Voice recognition not supported');
      return;
    }

    try {
      if (isListening) {
        recognitionRef.current.stop();
      }
      recognitionRef.current.start();
      setIsListening(true);
      setInput(''); // Clear input when starting to listen
    } catch (error) {
      console.error('Failed to start listening:', error);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleVoiceInput = () => {
    if (!recognitionRef.current) {
      toast.error('Voice recognition not supported');
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const toggleVoiceMode = () => {
    const newVoiceMode = !voiceMode;
    setVoiceMode(newVoiceMode);
    
    if (newVoiceMode) {
      toast.success('🎤 Voice Mode Activated - Hands-free conversation enabled!');
      // Start listening immediately in voice mode
      setTimeout(() => startListening(), 500);
    } else {
      toast.info('Voice Mode Deactivated');
      stopListening();
      // Cancel any ongoing speech
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    }
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Configure for natural female voice
      utterance.rate = 0.9;  // Slightly slower for clarity
      utterance.pitch = 1.2; // Higher pitch for female voice
      utterance.volume = 1;
      
      // Try to select a female voice
      const voices = window.speechSynthesis.getVoices();
      
      // Detect language from text (simple heuristic)
      const isHindi = /[\u0900-\u097F]/.test(text);
      const isSpanish = /[áéíóúñ¿¡]/i.test(text);
      const isFrench = /[àâäéèêëïîôùûü]/i.test(text);
      const isChinese = /[\u4e00-\u9fff]/.test(text);
      const isArabic = /[\u0600-\u06FF]/.test(text);
      
      // Select appropriate female voice based on language
      let selectedVoice = null;
      
      if (isHindi) {
        selectedVoice = voices.find(v => 
          (v.lang.includes('hi') || v.lang.includes('IN')) && v.name.toLowerCase().includes('female')
        ) || voices.find(v => v.lang.includes('hi') || v.lang.includes('IN'));
      } else if (isSpanish) {
        selectedVoice = voices.find(v => 
          v.lang.includes('es') && v.name.toLowerCase().includes('female')
        ) || voices.find(v => v.lang.includes('es'));
      } else if (isFrench) {
        selectedVoice = voices.find(v => 
          v.lang.includes('fr') && v.name.toLowerCase().includes('female')
        ) || voices.find(v => v.lang.includes('fr'));
      } else if (isChinese) {
        selectedVoice = voices.find(v => 
          v.lang.includes('zh') && v.name.toLowerCase().includes('female')
        ) || voices.find(v => v.lang.includes('zh'));
      } else if (isArabic) {
        selectedVoice = voices.find(v => 
          v.lang.includes('ar') && v.name.toLowerCase().includes('female')
        ) || voices.find(v => v.lang.includes('ar'));
      } else {
        // Default to English female voice
        selectedVoice = voices.find(v => 
          v.lang.includes('en') && (
            v.name.toLowerCase().includes('female') || 
            v.name.toLowerCase().includes('samantha') ||
            v.name.toLowerCase().includes('victoria') ||
            v.name.toLowerCase().includes('karen') ||
            v.name.toLowerCase().includes('serena') ||
            v.name.toLowerCase().includes('zira')
          )
        ) || voices.find(v => v.lang.includes('en-US') && v.name.includes('Female'));
      }
      
      // Fallback: Find any female voice
      if (!selectedVoice) {
        selectedVoice = voices.find(v => 
          v.name.toLowerCase().includes('female') || 
          v.name.toLowerCase().includes('woman') ||
          !v.name.toLowerCase().includes('male')
        );
      }
      
      // Set the voice if found
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      }
      
      utteranceRef.current = utterance;
      
      utterance.onstart = () => {
        setIsSpeaking(true);
        stopListening(); // Stop listening while speaking
      };
      
      utterance.onend = () => {
        setIsSpeaking(false);
        utteranceRef.current = null;
        
        // CRITICAL: Auto re-enter listening mode in voice mode
        if (voiceMode && !loading) {
          setTimeout(() => {
            startListening();
          }, 500);
        }
      };
      
      utterance.onerror = () => {
        setIsSpeaking(false);
        utteranceRef.current = null;
      };
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const sendVoiceMessage = async (messageText) => {
    if (!messageText.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      await saveChatOffline({ ...userMessage, session_id: sessionId });

      const response = await api.post('/tutor/chat', {
        message: messageText,
        session_id: sessionId,
        language: 'auto'
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      await saveChatOffline({ ...assistantMessage, session_id: sessionId });

      // Speak response (will auto-trigger listening after speaking in voice mode)
      if (voiceMode) {
        speakText(response.data.response);
      }
      
    } catch (error) {
      toast.error('Failed to get response. Please try again.');
      console.error('Chat error:', error);
      setMessages(prev => prev.filter(msg => msg.timestamp !== userMessage.timestamp));
      
      // Restart listening in voice mode after error
      if (voiceMode) {
        setTimeout(() => startListening(), 1000);
      }
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    const currentInput = input;
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      await saveChatOffline({ ...userMessage, session_id: sessionId });

      const response = await api.post('/tutor/chat', {
        message: currentInput,
        session_id: sessionId,
        language: 'auto'
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      await saveChatOffline({ ...assistantMessage, session_id: sessionId });

      // Speak response only in voice mode
      if (voiceMode) {
        speakText(response.data.response);
      }
      
      if (!voiceMode) {
        toast.success('Response received!', { duration: 1000 });
      }
    } catch (error) {
      toast.error('Failed to get response. Please try again.');
      console.error('Chat error:', error);
      setMessages(prev => prev.filter(msg => msg.timestamp !== userMessage.timestamp));
      setInput(currentInput);
    } finally {
      setLoading(false);
    }
  };

  // Simple animated avatar using CSS
  const AvatarAnimation = () => {
    return (
      <div className="relative w-48 h-48 mx-auto mb-6" data-testid="avatar-container">
        <div className={`avatar-circle ${isSpeaking ? 'speaking' : ''}`}>
          <div className="avatar-face">
            <div className="avatar-eyes">
              <div className="eye left"></div>
              <div className="eye right"></div>
            </div>
            <div className="avatar-mouth">
              {isSpeaking && (
                <div className="mouth-speaking"></div>
              )}
            </div>
          </div>
        </div>
        <style>{`
          .avatar-circle {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 32px rgba(74, 222, 128, 0.3);
            transition: all 0.3s ease;
          }
          
          .avatar-circle.speaking {
            animation: pulse 1s ease-in-out infinite;
          }
          
          @keyframes pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 8px 32px rgba(74, 222, 128, 0.3); }
            50% { transform: scale(1.05); box-shadow: 0 12px 48px rgba(74, 222, 128, 0.5); }
          }
          
          .avatar-face {
            position: relative;
            width: 80%;
            height: 80%;
          }
          
          .avatar-eyes {
            display: flex;
            justify-content: space-around;
            margin-top: 30%;
            padding: 0 20%;
          }
          
          .eye {
            width: 16px;
            height: 16px;
            background: white;
            border-radius: 50%;
            position: relative;
            animation: blink 4s infinite;
          }
          
          .eye::after {
            content: '';
            position: absolute;
            width: 8px;
            height: 8px;
            background: #1a1f2e;
            border-radius: 50%;
            top: 4px;
            left: 4px;
          }
          
          @keyframes blink {
            0%, 98%, 100% { transform: scaleY(1); }
            99% { transform: scaleY(0.1); }
          }
          
          .avatar-mouth {
            margin-top: 20px;
            text-align: center;
          }
          
          .mouth-speaking {
            width: 40px;
            height: 20px;
            background: white;
            border-radius: 0 0 40px 40px;
            margin: 0 auto;
            animation: speak 0.3s ease-in-out infinite;
          }
          
          @keyframes speak {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(0.6); }
          }
        `}</style>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col" data-testid="ai-tutor">
      {/* Chat History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl glass-effect rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <History className="h-6 w-6 text-blue-400" />
                Chat History
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {loadingHistory ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Loading history...</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                <button
                  onClick={startNewChat}
                  className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 rounded-lg p-4 text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <Plus className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">Start New Conversation</p>
                      <p className="text-sm text-gray-200">Begin a fresh chat session</p>
                    </div>
                  </div>
                </button>

                {chatSessions.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-500" />
                    <p className="text-gray-400">No chat history yet</p>
                  </div>
                ) : (
                  chatSessions.map((session, idx) => (
                    <button
                      key={session.session_id}
                      onClick={() => loadSession(session.session_id)}
                      className="w-full bg-white/5 hover:bg-white/10 rounded-lg p-4 text-left transition-all border border-white/10"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{session.preview}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs text-gray-400">
                              {new Date(session.timestamp).toLocaleDateString()} • {session.message_count} messages
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Avatar Section */}
      <div className="glass-effect rounded-2xl p-6 mb-6">
        <AvatarAnimation />
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Your AI Tutor</h2>
          <p className="text-gray-400 mb-4">Ask me anything! I'm here to help you learn.</p>
          
          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <Button
              onClick={() => setShowHistory(true)}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
              data-testid="show-history-btn"
            >
              <History className="h-5 w-5 mr-2" />
              History
            </Button>
            
            <Button
              onClick={startNewChat}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
              data-testid="new-chat-btn"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Chat
            </Button>
            
            <Button
              onClick={toggleVoiceMode}
              className={`${
                voiceMode 
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 animate-pulse' 
                  : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600'
              }`}
              data-testid="voice-mode-toggle"
            >
              <Mic className="h-5 w-5 mr-2" />
              {voiceMode ? 'Voice ON' : 'Voice OFF'}
            </Button>
          </div>

          {/* Voice Mode Status */}
          {voiceMode && (
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                {isListening && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-400 font-semibold">🎤 Listening...</span>
                  </div>
                )}
                {isSpeaking && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className="text-blue-400 font-semibold">🔊 Speaking...</span>
                  </div>
                )}
                {loading && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                    <span className="text-yellow-400 font-semibold">💭 Thinking...</span>
                  </div>
                )}
                {!isListening && !isSpeaking && !loading && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <span className="text-gray-400 font-semibold">⏸️ Ready</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-300">
                Hands-free mode: Speak naturally, I'll respond and listen again automatically
              </p>
            </div>
          )}
          
          {showInfo && messages.length === 0 && !voiceMode && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400">✨</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-semibold mb-1">Smart Features</h4>
                  <p className="text-sm text-gray-300">
                    • Auto language detection<br/>
                    • Voice Mode for hands-free learning<br/>
                    • Continuous conversation flow
                  </p>
                </div>
                <button 
                  onClick={() => setShowInfo(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 glass-effect rounded-2xl p-6 mb-4">
        <div className="space-y-4" data-testid="chat-messages">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Bot className="h-16 w-16 mx-auto mb-4 text-green-400 animate-pulse" />
              <h3 className="text-2xl font-bold text-white mb-2">Ready to Learn?</h3>
              <p className="text-gray-400 text-lg mb-4">Ask me anything in any language!</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                <button 
                  onClick={() => setInput("What is photosynthesis?")}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 transition-all"
                >
                  What is photosynthesis?
                </button>
                <button 
                  onClick={() => setInput("Explain Newton's laws")}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 transition-all"
                >
                  Explain Newton's laws
                </button>
                <button 
                  onClick={() => setInput("How do I learn Python?")}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 transition-all"
                >
                  How do I learn Python?
                </button>
              </div>
            </div>
          )}
          
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
              data-testid={`message-${index}`}
            >
              <div className={`flex items-start gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
                    : 'bg-gradient-to-r from-green-500 to-blue-500'
                }`}>
                  {msg.role === 'user' ? <User className="h-5 w-5 text-white" /> : <Bot className="h-5 w-5 text-white" />}
                </div>
                <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-xs opacity-60">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => speakText(msg.content)}
                        className="text-xs opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1"
                        title="Read aloud"
                      >
                        <Volume2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-r from-green-500 to-blue-500 animate-pulse">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div className="chat-bubble-assistant">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                    <span className="text-sm text-gray-300">Crafting your answer...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Section */}
      <form onSubmit={sendMessage} className="glass-effect rounded-2xl p-4">
        {voiceMode && isListening && input && (
          <div className="mb-3 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <p className="text-xs text-green-400 mb-1">🎤 You said:</p>
            <p className="text-white">{input}</p>
          </div>
        )}
        
        <div className="flex gap-2">
          {!voiceMode && (
            <Button
              type="button"
              onClick={handleVoiceInput}
              className={`${
                isListening 
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
              }`}
              data-testid="voice-input-btn"
            >
              {isListening ? (
                <div className="voice-wave">
                  <span></span><span></span><span></span><span></span><span></span>
                </div>
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
          )}
          
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={voiceMode ? "Voice Mode Active - Speak to chat..." : "Ask me anything..."}
            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            disabled={loading || (voiceMode && isListening)}
            data-testid="chat-input"
          />
          
          <Button
            type="submit"
            disabled={loading || !input.trim() || voiceMode}
            className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
            data-testid="send-message-btn"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
        
        {voiceMode && (
          <p className="text-xs text-center text-gray-400 mt-2">
            💡 Tip: Speak clearly and pause when done. I'll respond and listen again automatically!
          </p>
        )}
      </form>
    </div>
  );
};

export default AITutor;