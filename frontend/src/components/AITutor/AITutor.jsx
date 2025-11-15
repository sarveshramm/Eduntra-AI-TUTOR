import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Mic, Send, Volume2, Loader2, Bot, User } from 'lucide-react';
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
  const [sessionId] = useState(`session_${Date.now()}`);
  const [showInfo, setShowInfo] = useState(true);
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
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.volume = 1;
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
      {/* Avatar Section */}
      <div className="glass-effect rounded-2xl p-6 mb-6">
        <AvatarAnimation />
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Your AI Tutor</h2>
          <p className="text-gray-400 mb-4">Ask me anything! I'm here to help you learn.</p>
          
          {showInfo && messages.length === 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400">✨</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-semibold mb-1">Smart Language Detection</h4>
                  <p className="text-sm text-gray-300">
                    I automatically detect and respond in your language! Type in English, Hindi, Spanish, or any other language, and I'll match it.
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
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleVoiceInput}
            className={`${
              isListening 
                ? 'bg-red-500 hover:bg-red-600' 
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
          
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            disabled={loading}
            data-testid="chat-input"
          />
          
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
            data-testid="send-message-btn"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AITutor;