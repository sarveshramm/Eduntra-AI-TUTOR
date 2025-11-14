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
  const [sessionId] = useState(`session_${Date.now()}`);
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
        toast.error('Voice recognition error');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleVoiceInput = () => {
    if (!recognitionRef.current) {
      toast.error('Voice recognition not supported');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
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

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Save offline
      await saveChatOffline({ ...userMessage, session_id: sessionId });

      const response = await api.post('/tutor/chat', {
        message: input,
        session_id: sessionId,
        language: 'English'
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      await saveChatOffline({ ...assistantMessage, session_id: sessionId });

      // Speak response
      speakText(response.data.response);
    } catch (error) {
      toast.error('Failed to get response');
      console.error('Chat error:', error);
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
      <div className="glass-effect rounded-2xl p-6 mb-6 text-center">
        <AvatarAnimation />
        <h2 className="text-2xl font-bold text-white mb-2">Your AI Tutor</h2>
        <p className="text-gray-400">Ask me anything! I'm here to help you learn.</p>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 glass-effect rounded-2xl p-6 mb-4">
        <div className="space-y-4" data-testid="chat-messages">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Bot className="h-16 w-16 mx-auto mb-4 text-green-400" />
              <p className="text-gray-400 text-lg">Start a conversation to begin learning!</p>
            </div>
          )}
          
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
              data-testid={`message-${index}`}
            >
              <div className={`flex items-start gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
                    : 'bg-gradient-to-r from-green-500 to-blue-500'
                }`}>
                  {msg.role === 'user' ? <User className="h-5 w-5 text-white" /> : <Bot className="h-5 w-5 text-white" />}
                </div>
                <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs opacity-60 mt-2">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-r from-green-500 to-blue-500">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div className="chat-bubble-assistant flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Thinking...</span>
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