'use client';

import { useState, useEffect, useCallback } from 'react';
import { Send, Volume2, Radio, Clock } from 'lucide-react';
import { SpeechToTextButton } from '@/components/SpeechToTextButton';
import { EmergencyButton } from '@/components/EmergencyButton';
import { EmergencyAlert } from '@/components/EmergencyAlert';
import { EngineRoomFlashingLED } from '@/components/EngineRoomFlashingLED';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function MainInterface() {
  // MCR State
  const [manualText, setManualText] = useState('');
  const [language, setLanguage] = useState<'en-US' | 'hi-IN'>('en-US');
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // WebSocket connection
  const {
    isConnected,
    connectedDevices,
    messages,
    sendMessage,
    registerDevice,
    emergencyAlert,
    clearEmergencyAlert,
  } = useWebSocket();

  // Filter messages for different displays
  const sentMessages = messages.filter((m) => m.source === 'MCR').slice(-3);
  const receivedMessages = messages.slice(-3);
  const currentMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;

  // Check speech synthesis support
  const checkSpeechSupport = useCallback(() => {
    if (typeof window !== 'undefined') {
      const hasSynthesis = 'speechSynthesis' in window;
      setSpeechSupported(hasSynthesis);
      return hasSynthesis;
    }
    return false;
  }, []);

  // Register MCR device on connection
  useEffect(() => {
    if (isConnected) {
      registerDevice({
        id: 'MCR',
        name: 'Machinery Control Room',
        type: 'mcr',
        language,
      });
    }
  }, [isConnected, registerDevice, language]);

  // Handle emergency activation
  const handleEmergencyActivate = useCallback(() => {
    const emergencyText =
      '🚨 EMERGENCY ALERT - IMMEDIATE ASSISTANCE REQUIRED IN ENGINE ROOM 🚨';
    sendMessage({
      text: emergencyText,
      channel: 'emergency-broadcast',
      source: 'MCR',
      type: 'emergency',
    });
  }, [sendMessage]);

  // Stop emergency alert
  const handleStopEmergency = useCallback(() => {
    clearEmergencyAlert();
  }, [clearEmergencyAlert]);

  // Text to speech
  const speakText = useCallback(
    (text: string) => {
      if (!speechSupported || !text.trim()) return;

      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();

          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = language;
          utterance.rate = 0.9;
          utterance.volume = 1;

          utterance.onstart = () => setIsSpeaking(true);
          utterance.onend = () => setIsSpeaking(false);
          utterance.onerror = () => setIsSpeaking(false);

          window.speechSynthesis.speak(utterance);
        }
      } catch (error) {
        console.error('TTS error:', error);
        setIsSpeaking(false);
      }
    },
    [speechSupported, language]
  );

  // Handle voice transcript
  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      if (transcript.trim()) {
        sendMessage({
          text: transcript.trim(),
          channel: 'mcr-to-engine',
          source: 'MCR',
          type: 'normal',
        });
      }
    },
    [sendMessage]
  );

  // Send manual message
  const sendManualMessage = useCallback(() => {
    if (manualText.trim()) {
      sendMessage({
        text: manualText.trim(),
        channel: 'mcr-to-engine',
        source: 'MCR',
        type: 'normal',
      });
      setManualText('');
    }
  }, [manualText, sendMessage]);

  // Format time
  const formatTime = useCallback((timestamp: string) => {
    if (typeof window === 'undefined') return ''; // Return empty string during SSR
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, []);

  // Initialize
  useEffect(() => {
    checkSpeechSupport();
    setIsClient(true);

    // Set initial time
    setCurrentTime(new Date());

    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, [checkSpeechSupport]);

  return (
    <div className='h-screen bg-gray-900 text-white overflow-hidden'>
      {/* Emergency Alert Overlay */}
      <EmergencyAlert
        isActive={!!emergencyAlert}
        onStop={handleStopEmergency}
      />

      {/* Engine Room Flashing LED */}
      <EngineRoomFlashingLED isEmergency={!!emergencyAlert} />

      {/* Header */}
      <div className='bg-gray-800 border-b-4 border-green-400 p-3'>
        <div className='flex items-center justify-between flex-wrap gap-4'>
          <h1 className='text-2xl font-bold text-green-400 tracking-wide'>
            SOL9X INDUSTRIAL COMMUNICATION SYSTEM
          </h1>
          <div className='flex items-center gap-6'>
            {isClient && (
              <div className='flex items-center gap-2 text-green-400 font-mono text-lg'>
                <Clock className='w-5 h-5' />
                {currentTime ? (
                  currentTime.toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                ) : (
                  <span className='inline-block w-20'>--:--:--</span>
                )}
              </div>
            )}
            <div className='flex gap-2'>
              <button
                onClick={() => setLanguage('en-US')}
                className={`px-4 py-2 border-2 rounded font-bold text-sm transition-all ${
                  language === 'en-US'
                    ? 'border-green-400 text-green-400 bg-green-400/10'
                    : 'border-gray-600 text-gray-400 hover:border-gray-500'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('hi-IN')}
                className={`px-4 py-2 border-2 rounded font-bold text-sm transition-all ${
                  language === 'hi-IN'
                    ? 'border-green-400 text-green-400 bg-green-400/10'
                    : 'border-gray-600 text-gray-400 hover:border-gray-500'
                }`}
              >
                हिं
              </button>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className='mt-4 flex items-center gap-4 text-sm'>
          <div className='flex items-center gap-2 text-green-400'>
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-400' : 'bg-red-400'
              }`}
            ></div>
            System: {isConnected ? 'Online' : 'Offline'}
          </div>
          <div className='flex items-center gap-2 text-blue-400'>
            <div className='w-2 h-2 rounded-full bg-blue-400'></div>
            Connected Devices: {connectedDevices.length}
          </div>
          {emergencyAlert && (
            <div className='flex items-center gap-2 text-red-400 animate-pulse'>
              <div className='w-2 h-2 rounded-full bg-red-400'></div>
              EMERGENCY ALERT ACTIVE
            </div>
          )}
        </div>
      </div>

      {/* Main Interface */}
      <div className='grid grid-cols-1 lg:grid-cols-2 h-[calc(100vh-120px)]'>
        {/* MCR Control Panel - Left Side */}
        <div className='bg-gray-900 border-r-4 border-green-400 p-4 overflow-y-auto'>
          <div className='h-full flex flex-col'>
            <div className='flex items-center gap-3 mb-6'>
              <Radio className='w-6 h-6 text-green-400' />
              <h2 className='text-xl font-bold text-green-400'>
                {language === 'hi-IN'
                  ? 'एमसीआर संचार कंसोल'
                  : 'MCR COMMUNICATION CONSOLE'}
              </h2>
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                }`}
              ></div>
            </div>

            {/* Manual Text Input Section */}
            <div className='bg-gray-800 border-4 border-blue-400/30 rounded-lg p-4 mb-4'>
              <h3 className='text-blue-400 text-lg font-bold mb-4'>
                {language === 'hi-IN'
                  ? '✍️ मैनुअल टेक्स्ट इनपुट'
                  : '✍️ MANUAL TEXT INPUT'}
              </h3>
              <div className='space-y-4'>
                <input
                  type='text'
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder={
                    language === 'hi-IN'
                      ? 'यहाँ अपना संदेश टाइप करें...'
                      : 'Type your message here...'
                  }
                  className='w-full bg-gray-900 border-2 border-blue-400/30 text-blue-300 font-mono p-3 rounded focus:outline-none focus:border-blue-400'
                  onKeyDown={(e) => e.key === 'Enter' && sendManualMessage()}
                  disabled={!isConnected}
                />
                <button
                  onClick={sendManualMessage}
                  disabled={!manualText.trim() || !isConnected}
                  className='w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold py-3 border-4 border-blue-400 rounded transition-all flex items-center justify-center gap-2'
                >
                  <Send className='w-5 h-5' />
                  {language === 'hi-IN'
                    ? 'टेक्स्ट संदेश भेजें'
                    : 'SEND TEXT MESSAGE'}
                </button>
              </div>
            </div>

            {/* Last 3 Messages Sent */}
            <div className='bg-gray-800 border-4 border-gray-600 rounded-lg p-4 flex-1'>
              <h3 className='text-gray-400 text-lg font-bold mb-4'>
                {language === 'hi-IN' ? 'भेजे गए संदेश' : 'MESSAGES SENT'}
              </h3>
              <div className='space-y-2 max-h-[120px] overflow-y-auto'>
                {sentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`border-2 rounded p-3 ${
                      msg.type === 'emergency'
                        ? 'bg-red-900 border-red-600'
                        : 'bg-gray-900 border-gray-600'
                    }`}
                  >
                    <div className='text-xs text-gray-400 mb-2 flex items-center gap-2'>
                      {msg.type === 'emergency' && (
                        <span className='text-red-400'>🚨</span>
                      )}
                      {formatTime(msg.timestamp)}
                    </div>
                    <p
                      className={`text-sm font-mono ${
                        msg.type === 'emergency'
                          ? 'text-red-300'
                          : 'text-gray-300'
                      }`}
                    >
                      {msg.text}
                    </p>
                  </div>
                ))}
                {sentMessages.length === 0 && (
                  <div className='text-center text-gray-500 py-8 text-lg'>
                    {language === 'hi-IN'
                      ? 'अभी तक कोई संदेश नहीं भेजा गया'
                      : 'No messages sent yet'}
                  </div>
                )}
              </div>
            </div>

            {/* Emergency Alert System */}
            <div className='mt-6'>
              <EmergencyButton
                onEmergencyActivate={handleEmergencyActivate}
                disabled={!!emergencyAlert || !isConnected}
                language={language}
              />
            </div>
          </div>
        </div>

        {/* Engine Room LED Display - Right Side */}
        <div className='bg-black p-4 overflow-y-auto'>
          <div className='h-full flex flex-col'>
            <div className='flex items-center gap-3 mb-6'>
              <div
                className={`w-6 h-6 rounded-sm ${
                  isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                }`}
              ></div>
              <h2 className='text-xl font-bold text-green-400 font-mono tracking-wider'>
                {language === 'hi-IN'
                  ? 'इंजन रूम संदेश डिस्प्ले'
                  : 'ENGINE ROOM MESSAGE DISPLAY'}
              </h2>
            </div>

            {/* Main LED Display */}
            <div
              className={`border-4 rounded-lg mb-4 flex-1 p-4 ${
                emergencyAlert
                  ? 'bg-red-900 border-red-400'
                  : 'bg-black border-green-400'
              }`}
            >
              <div className='h-full flex flex-col justify-center'>
                {currentMessage ? (
                  <div className='text-center'>
                    <div
                      className={`font-mono text-2xl lg:text-4xl leading-relaxed tracking-wider mb-4 min-h-[100px] flex items-center justify-center border-4 rounded p-4 ${
                        currentMessage.type === 'emergency'
                          ? 'text-red-400 border-red-400/30 bg-red-900/50 animate-pulse'
                          : 'text-green-400 border-green-400/30 bg-gray-900/50'
                      }`}
                    >
                      {currentMessage.text}
                    </div>
                    <div
                      className={`font-mono text-lg mb-6 ${
                        currentMessage.type === 'emergency'
                          ? 'text-red-400/70'
                          : 'text-green-400/70'
                      }`}
                    >
                      FROM: {currentMessage.source} | TIME:{' '}
                      {formatTime(currentMessage.timestamp)}
                    </div>
                    {currentMessage.type !== 'emergency' && (
                      <button
                        onClick={() => speakText(currentMessage.text)}
                        disabled={!speechSupported}
                        className={`bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed border-4 border-green-400 text-black font-bold py-3 px-6 rounded transition-all flex items-center justify-center gap-2 mx-auto ${
                          isSpeaking ? 'animate-pulse' : ''
                        }`}
                      >
                        <Volume2 className='w-5 h-5' />
                        {language === 'hi-IN' ? 'संदेश चलाएं' : 'PLAY MESSAGE'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className='text-center text-green-400/50 font-mono text-2xl lg:text-3xl'>
                    {language === 'hi-IN'
                      ? 'आने वाले संदेश का इंतज़ार...'
                      : 'WAITING FOR INCOMING MESSAGE...'}
                  </div>
                )}
              </div>
            </div>

            {/* Last 3 Received Messages */}
            <div className='bg-gray-900 border-4 border-green-400/30 rounded-lg p-4'>
              <h3 className='text-green-400 text-lg font-bold font-mono mb-4'>
                {language === 'hi-IN' ? 'संदेश इतिहास' : 'MESSAGE HISTORY'}
              </h3>
              <div className='space-y-2 max-h-[120px] overflow-y-auto'>
                {receivedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`border-2 rounded p-3 ${
                      msg.type === 'emergency'
                        ? 'bg-red-900 border-red-400/30'
                        : 'bg-black border-green-400/30'
                    }`}
                  >
                    <div className='flex justify-between items-center mb-2'>
                      <span
                        className={`text-xs font-mono ${
                          msg.type === 'emergency'
                            ? 'text-red-400/70'
                            : 'text-green-400/70'
                        }`}
                      >
                        {msg.type === 'emergency' && '🚨 '}
                        {formatTime(msg.timestamp)}
                      </span>
                      {msg.type !== 'emergency' && (
                        <button
                          onClick={() => speakText(msg.text)}
                          disabled={!speechSupported}
                          className='text-green-400 hover:text-green-300 disabled:opacity-50 p-1 rounded'
                        >
                          <Volume2 className='w-4 h-4' />
                        </button>
                      )}
                    </div>
                    <p
                      className={`text-sm font-mono ${
                        msg.type === 'emergency'
                          ? 'text-red-300'
                          : 'text-green-300'
                      }`}
                    >
                      {msg.text}
                    </p>
                  </div>
                ))}
                {receivedMessages.length === 0 && (
                  <div className='text-center text-green-400/50 py-4 font-mono text-lg'>
                    {language === 'hi-IN'
                      ? 'कोई संदेश प्राप्त नहीं हुआ'
                      : 'NO MESSAGES RECEIVED'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
