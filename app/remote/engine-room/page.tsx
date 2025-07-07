'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Volume2,
  Radio,
  Wifi,
  WifiOff,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { SpeechToTextButton } from '@/components/SpeechToTextButton';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function EngineRoomRemote() {
  const [manualText, setManualText] = useState('');
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [language, setLanguage] = useState<'en-US' | 'hi-IN'>('en-US');
  const [speechSupported, setSpeechSupported] = useState(false);

  // WebSocket connection
  const {
    isConnected,
    connectedDevices,
    messages,
    sendMessage,
    registerDevice,
  } = useWebSocket();

  // Filter messages for engine room
  const relevantMessages = messages
    .filter(
      (m) =>
        m.channel === 'mcr-broadcast' ||
        m.channel === 'emergency-broadcast' ||
        m.source === 'MCR-REMOTE' ||
        m.source === 'MCR' ||
        m.source === 'ENGINE-ROOM'
    )
    .slice(-8);

  // Check speech synthesis support
  const checkSpeechSupport = useCallback(() => {
    if (typeof window !== 'undefined') {
      const hasSynthesis = 'speechSynthesis' in window;
      setSpeechSupported(hasSynthesis);
      return hasSynthesis;
    }
    return false;
  }, []);

  // Connect to network
  const connectToNetwork = useCallback(() => {
    if (isConnected) {
      registerDevice({
        id: 'ENGINE-ROOM',
        name: 'Engine Room Watchkeeper',
        type: 'engine',
        language,
      });
      setIsDeviceConnected(true);

      // Send connection message
      setTimeout(() => {
        sendMessage({
          text: 'Engine Room Watchkeeper connected',
          channel: 'device-status',
          source: 'ENGINE-ROOM',
          type: 'normal',
        });
      }, 1000);
    }
  }, [isConnected, language, registerDevice, sendMessage]);

  // Disconnect from network
  const disconnectFromNetwork = useCallback(() => {
    setIsDeviceConnected(false);
  }, []);

  // Send message
  const handleSendMessage = useCallback(
    (text: string, type: 'emergency' | 'normal' | 'status' = 'normal') => {
      if (!text.trim() || !isDeviceConnected) return;

      setIsTransmitting(true);

      const message = {
        text: text.trim(),
        channel: type === 'emergency' ? 'emergency-broadcast' : 'engine-to-mcr',
        source: 'ENGINE-ROOM',
        type: type === 'status' ? 'normal' : type,
        timestamp: new Date().toISOString(),
      };

      sendMessage(message);
      setTimeout(() => setIsTransmitting(false), 500);
    },
    [isDeviceConnected, sendMessage]
  );

  // Handle voice transcript
  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      if (transcript.trim()) {
        handleSendMessage(transcript);
      }
    },
    [handleSendMessage]
  );

  // Send manual message
  const sendManualMessage = useCallback(() => {
    if (manualText.trim()) {
      handleSendMessage(manualText);
      setManualText('');
    }
  }, [manualText, handleSendMessage]);

  // Format time
  const formatTime = useCallback((timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '--:--';
    }
  }, []);

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

          window.speechSynthesis.speak(utterance);
        }
      } catch (error) {
        console.error('TTS error:', error);
      }
    },
    [speechSupported, language]
  );

  // Initialize
  useEffect(() => {
    checkSpeechSupport();
  }, [checkSpeechSupport]);

  if (!isDeviceConnected) {
    return (
      <div className='h-screen bg-gray-900 text-white flex items-center justify-center overflow-hidden'>
        <div className='max-w-md mx-auto bg-gray-800 border-4 border-blue-400 rounded-lg shadow-2xl p-8'>
          <div className='text-center'>
            <Radio className='w-16 h-16 text-blue-400 mx-auto mb-4' />
            <h1 className='text-2xl font-bold text-blue-400 mb-2'>
              ENGINE ROOM WATCHKEEPER
            </h1>

            {/* Connection Status */}
            <div className='mb-4'>
              <div
                className={`flex items-center justify-center gap-2 text-sm ${
                  isConnected ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {isConnected ? (
                  <Wifi className='w-4 h-4' />
                ) : (
                  <WifiOff className='w-4 h-4' />
                )}
                {isConnected ? 'Server Connected' : 'Connecting to Server...'}
              </div>
            </div>

            <p className='text-gray-400 mb-6'>
              {language === 'hi-IN'
                ? 'नेटवर्क से कनेक्ट करने के लिए कनेक्ट बटन दबाएं'
                : 'Press CONNECT to join the communication network'}
            </p>

            <div className='mb-6 p-4 bg-gray-900 border-2 border-blue-400/30 rounded'>
              <h3 className='text-sm font-bold text-blue-400 mb-2'>
                {language === 'hi-IN'
                  ? 'कनेक्ट होने पर आप जुड़ेंगे:'
                  : 'You will connect to:'}
              </h3>
              <ul className='text-sm text-gray-300 space-y-1'>
                <li>• MCR Control Panel</li>
                <li>• Other Engine Room Devices</li>
              </ul>
            </div>

            <div className='flex gap-2 mb-4 justify-center'>
              <button
                onClick={() => setLanguage('en-US')}
                className={`px-3 py-1 border-2 rounded text-xs font-bold transition-all ${
                  language === 'en-US'
                    ? 'border-blue-400 text-blue-400 bg-blue-400/10'
                    : 'border-gray-500 text-gray-400 hover:border-gray-400'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('hi-IN')}
                className={`px-3 py-1 border-2 rounded text-xs font-bold transition-all ${
                  language === 'hi-IN'
                    ? 'border-blue-400 text-blue-400 bg-blue-400/10'
                    : 'border-gray-500 text-gray-400 hover:border-gray-400'
                }`}
              >
                हिं
              </button>
            </div>

            <button
              onClick={connectToNetwork}
              disabled={!isConnected}
              className='w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed border-4 border-blue-400 text-white font-bold py-4 rounded transition-all flex items-center justify-center gap-3 text-lg'
            >
              {!isConnected
                ? language === 'hi-IN'
                  ? 'सर्वर से कनेक्ट हो रहा है...'
                  : 'CONNECTING TO SERVER...'
                : language === 'hi-IN'
                ? 'नेटवर्क से कनेक्ट करें'
                : 'CONNECT TO NETWORK'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='h-screen bg-gray-900 text-white overflow-hidden'>
      {/* Device Frame */}
      <div className='max-w-md mx-auto bg-gray-800 border-4 border-blue-500 rounded-lg shadow-2xl h-full flex flex-col'>
        {/* Header */}
        <div className='bg-gray-700 p-3 border-b-4 border-blue-400 flex-shrink-0'>
          <div className='flex items-center justify-between mb-2'>
            <div className='flex items-center gap-2'>
              <Radio className='w-6 h-6 text-blue-400' />
              <h1 className='text-xl font-bold text-blue-400'>
                ENGINE ROOM WATCHKEEPER
              </h1>
            </div>
            <div className='flex items-center gap-2'>
              <div className='bg-green-600 text-green-100 border-2 border-green-400 px-3 py-1 rounded font-bold text-sm flex items-center gap-1'>
                <Wifi className='w-3 h-3' />
                {language === 'hi-IN' ? 'जुड़ा हुआ' : 'CONNECTED'}
              </div>
              <button
                onClick={disconnectFromNetwork}
                className='bg-red-600 hover:bg-red-700 border-2 border-red-400 text-white px-2 py-1 rounded text-xs'
              >
                {language === 'hi-IN' ? 'डिस्कनेक्ट' : 'DISCONNECT'}
              </button>
            </div>
          </div>

          {/* Connected Devices */}
          <div className='text-xs text-gray-300 flex items-center gap-2'>
            <span>
              {language === 'hi-IN' ? 'कनेक्टेड:' : 'Connected:'}{' '}
              {connectedDevices.length}
            </span>
            <div className='flex-1 h-1 bg-gray-600 rounded-full overflow-hidden'>
              <div
                className='h-full bg-blue-400 transition-all duration-500'
                style={{
                  width: `${Math.min(100, connectedDevices.length * 50)}%`,
                }}
              ></div>
            </div>
          </div>

          <div className='flex gap-2 mt-2'>
            <button
              onClick={() => setLanguage('en-US')}
              className={`px-3 py-1 border-2 rounded text-xs font-bold transition-all ${
                language === 'en-US'
                  ? 'border-blue-400 text-blue-400 bg-blue-400/10'
                  : 'border-gray-500 text-gray-400 hover:border-gray-400'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('hi-IN')}
              className={`px-3 py-1 border-2 rounded text-xs font-bold transition-all ${
                language === 'hi-IN'
                  ? 'border-blue-400 text-blue-400 bg-blue-400/10'
                  : 'border-gray-500 text-gray-400 hover:border-gray-400'
              }`}
            >
              हिं
            </button>
          </div>
        </div>

        {/* Content */}
        <div className='p-3 space-y-3 flex-1 overflow-y-auto'>
          {/* Current Time */}
          <div className='bg-gray-900 border-2 border-blue-400/30 rounded-lg p-3 text-center'>
            <div className='text-blue-400 text-sm font-bold mb-1'>
              {language === 'hi-IN' ? 'वर्तमान समय' : 'CURRENT TIME'}
            </div>
            <div className='text-2xl font-mono text-blue-300'>
              {new Date().toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
          </div>

          {/* Voice Input */}
          <div className='bg-gray-900 border-2 border-green-400/30 rounded-lg p-3'>
            <h3 className='text-green-400 text-sm font-bold mb-3'>
              {language === 'hi-IN' ? '🎙️ आवाज़ इनपुट' : '🎙️ VOICE INPUT'}
            </h3>
            <SpeechToTextButton
              onTranscript={handleVoiceTranscript}
              language={language}
              disabled={isTransmitting || !isConnected}
            />
          </div>

          {/* Manual Text Input */}
          <div className='bg-gray-900 border-2 border-blue-400/30 rounded-lg p-3'>
            <h3 className='text-blue-400 text-sm font-bold mb-3'>
              {language === 'hi-IN' ? '✍️ टेक्स्ट इनपुट' : '✍️ TEXT INPUT'}
            </h3>
            <div className='space-y-3'>
              <input
                type='text'
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={
                  language === 'hi-IN'
                    ? 'संदेश टाइप करें...'
                    : 'Type message...'
                }
                className='w-full bg-gray-800 border-2 border-blue-400/30 text-blue-300 text-sm p-2 rounded focus:outline-none focus:border-blue-400'
                onKeyDown={(e) => e.key === 'Enter' && sendManualMessage()}
                disabled={!isConnected}
              />
              <button
                onClick={sendManualMessage}
                disabled={!manualText.trim() || isTransmitting || !isConnected}
                className='w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-400 text-sm font-bold py-2 rounded transition-all flex items-center justify-center gap-2'
              >
                <Send className='w-4 h-4' />
                {language === 'hi-IN' ? 'भेजें' : 'SEND'}
              </button>
            </div>
          </div>

          {/* Message History */}
          <div className='bg-gray-900 border-2 border-amber-400/30 rounded-lg p-3'>
            <h3 className='text-amber-400 text-sm font-bold mb-3'>
              {language === 'hi-IN' ? 'संदेश इतिहास' : 'MESSAGE HISTORY'}
            </h3>
            <div className='space-y-2 max-h-[150px] overflow-y-auto'>
              {relevantMessages.map((msg, index) => (
                <div
                  key={`${msg.id}-${index}`}
                  className={`p-2 rounded border-2 text-xs ${
                    msg.source === 'ENGINE-ROOM'
                      ? 'bg-blue-900/30 border-blue-400/30 text-blue-300'
                      : msg.type === 'emergency'
                      ? 'bg-red-900/30 border-red-400/30 text-red-300'
                      : 'bg-green-900/30 border-green-400/30 text-green-300'
                  }`}
                >
                  <div className='flex justify-between items-center mb-1'>
                    <span className='text-xs opacity-70'>
                      {msg.source === 'ENGINE-ROOM'
                        ? language === 'hi-IN'
                          ? 'आप'
                          : 'YOU'
                        : msg.source}{' '}
                      - {formatTime(msg.timestamp)}
                    </span>
                    <button
                      onClick={() => speakText(msg.text)}
                      disabled={!speechSupported}
                      className='p-1 rounded hover:bg-white/10 disabled:opacity-50'
                    >
                      <Volume2 className='w-3 h-3' />
                    </button>
                  </div>
                  <p className='font-mono'>{msg.text}</p>
                </div>
              ))}
              {relevantMessages.length === 0 && (
                <div className='text-center text-gray-500 py-4 text-xs'>
                  {language === 'hi-IN'
                    ? 'अभी तक कोई संदेश नहीं'
                    : 'No messages yet'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className='bg-gray-700 p-2 rounded-b-lg border-t-2 border-gray-600'>
          <div className='flex items-center justify-center gap-2 text-xs'>
            <div
              className={`w-2 h-2 rounded-full ${
                isTransmitting
                  ? 'bg-amber-400 animate-pulse'
                  : isConnected
                  ? 'bg-green-400'
                  : 'bg-red-400'
              }`}
            ></div>
            <span className='text-gray-300 font-mono'>
              {isTransmitting
                ? language === 'hi-IN'
                  ? 'भेज रहा है...'
                  : 'TRANSMITTING...'
                : isConnected
                ? language === 'hi-IN'
                  ? 'तैयार'
                  : 'READY'
                : language === 'hi-IN'
                ? 'कनेक्ट नहीं है'
                : 'DISCONNECTED'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
