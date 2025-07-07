'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Volume2,
  Radio,
  Wifi,
  WifiOff,
  Clock,
  AlertCircle,
  Bell,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Settings,
  Zap,
  Users,
  Link,
} from 'lucide-react';
import { SpeechToTextButton } from '@/components/SpeechToTextButton';
import { useWebSocket } from '@/hooks/useWebSocket';

const MCR_COMMANDS = [
  {
    id: 'cmd1',
    label: 'STATUS',
    text: 'Requesting status update',
    icon: CheckCircle,
    color: 'blue',
  },
  {
    id: 'cmd2',
    label: 'ACKNOWLEDGE',
    text: 'Message acknowledged',
    icon: CheckCircle,
    color: 'green',
  },
  {
    id: 'cmd3',
    label: 'ALERT',
    text: 'Attention required - non-emergency',
    icon: AlertTriangle,
    color: 'amber',
  },
  {
    id: 'cmd4',
    label: 'EMERGENCY',
    text: 'EMERGENCY - Immediate action required',
    icon: Zap,
    color: 'red',
  },
];

export default function MCRRemote() {
  const [deviceId, setDeviceId] = useState<'MCR-REMOTE' | 'A' | 'B'>(
    'MCR-REMOTE'
  );
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);
  const [manualText, setManualText] = useState('');
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

  // Filter messages for MCR remote
  const relevantMessages = messages
    .filter(
      (m) =>
        m.channel === 'engine-to-mcr' ||
        m.channel === 'mcr-broadcast' ||
        m.channel === 'emergency-broadcast' ||
        m.source === 'ENGINE-ROOM' ||
        m.source === 'MCR-REMOTE'
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
      const deviceInfo = {
        id: 'MCR-REMOTE',
        name: 'MCR Remote Control',
        type: 'remote' as const,
        language,
      };

      registerDevice(deviceInfo);
      setIsDeviceConnected(true);

      // Send connection message
      setTimeout(() => {
        sendMessage({
          text: 'MCR Remote Control connected',
          channel: 'mcr-broadcast',
          source: 'MCR-REMOTE',
          type: 'normal',
        });
      }, 1000);
    }
  }, [isConnected, language, registerDevice, sendMessage]);

  // Disconnect from network
  const disconnectFromNetwork = useCallback(() => {
    setIsDeviceConnected(false);
    localStorage.removeItem('deviceInfo');
  }, []);

  // Send message from MCR remote
  const handleSendMessage = useCallback(
    (text: string, type: 'emergency' | 'normal' | 'status' = 'normal') => {
      if (!text.trim() || !isDeviceConnected) return;

      setIsTransmitting(true);

      // Use status channel for status messages, emergency for emergencies, and default to mcr-broadcast for normal
      const channel =
        type === 'emergency'
          ? 'emergency-broadcast'
          : type === 'status'
          ? 'status-updates'
          : 'mcr-broadcast';

      sendMessage({
        text: text.trim(),
        channel,
        source: 'MCR-REMOTE',
        type: 'normal',
      });

      setTimeout(() => setIsTransmitting(false), 500);
    },
    [isDeviceConnected, sendMessage]
  );

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

  // Send command message
  const sendCommandMessage = useCallback(
    (command: (typeof MCR_COMMANDS)[0]) => {
      const messageText = `${command.label}: ${command.text}`;
      handleSendMessage(
        messageText,
        command.id === 'cmd4' ? 'emergency' : 'normal'
      );
    },
    [handleSendMessage]
  );

  // Acknowledge message
  const acknowledgeMessage = useCallback(
    (messageText: string) => {
      handleSendMessage(
        `ACK: ${messageText.substring(0, 20)}${
          messageText.length > 20 ? '...' : ''
        }`,
        'status'
      );
    },
    [handleSendMessage]
  );

  // Format time
  const formatTime = useCallback((timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Get color classes
  const getColorClasses = useCallback((color: string) => {
    switch (color) {
      case 'green':
        return 'bg-green-600 hover:bg-green-700 border-green-400 text-green-100';
      case 'blue':
        return 'bg-blue-600 hover:bg-blue-700 border-blue-400 text-blue-100';
      case 'amber':
        return 'bg-amber-600 hover:bg-amber-700 border-amber-400 text-amber-100';
      case 'red':
        return 'bg-red-600 hover:bg-red-700 border-red-400 text-red-100';
      default:
        return 'bg-gray-600 hover:bg-gray-700 border-gray-400 text-gray-100';
    }
  }, []);

  // Initialize device ID from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const device = urlParams.get('device') as 'A' | 'B';
    if (device === 'A' || device === 'B') {
      setDeviceId(device);
    }
    checkSpeechSupport();
  }, [checkSpeechSupport]);

  // Auto-connect if previously connected
  useEffect(() => {
    if (isConnected && !isDeviceConnected) {
      const savedDeviceInfo = localStorage.getItem('deviceInfo');
      if (savedDeviceInfo) {
        try {
          const deviceInfo = JSON.parse(savedDeviceInfo);
          if (deviceInfo.id === `REMOTE-${deviceId}`) {
            setIsDeviceConnected(true);
          }
        } catch (error) {
          console.error('Error parsing saved device info:', error);
        }
      }
    }
  }, [isConnected, isDeviceConnected, deviceId]);

  if (!isDeviceConnected) {
    return (
      <div className='h-screen bg-gray-900 text-white flex items-center justify-center overflow-hidden'>
        <div className='max-w-md mx-auto bg-gray-800 border-4 border-green-400 rounded-lg shadow-2xl p-8'>
          <div className='text-center'>
            <Radio className='w-16 h-16 text-green-400 mx-auto mb-4' />
            <h1 className='text-2xl font-bold text-green-400 mb-2'>
              MCR REMOTE CONTROL
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
                {isConnected
                  ? 'WebSocket Connected'
                  : 'Connecting to Server...'}
              </div>
            </div>

            <p className='text-gray-400 mb-6'>
              {language === 'hi-IN'
                ? 'नेटवर्क से कनेक्ट करने के लिए कनेक्ट बटन दबाएं'
                : 'Press CONNECT to join the communication network'}
            </p>

            <div className='mb-6 p-4 bg-gray-900 border-2 border-gray-600 rounded'>
              <h3 className='text-sm font-bold text-gray-400 mb-2'>
                {language === 'hi-IN'
                  ? 'कनेक्ट होने पर आप जुड़ेंगे:'
                  : 'You will connect to:'}
              </h3>
              <ul className='text-sm text-gray-300 space-y-1'>
                <li>
                  •{' '}
                  {language === 'hi-IN'
                    ? 'एमसीआर कंट्रोल पैनल'
                    : 'MCR Control Panel'}
                </li>
                <li>
                  •{' '}
                  {language === 'hi-IN'
                    ? 'इंजन रूम डिस्प्ले'
                    : 'Engine Room Display'}
                </li>
                <li>
                  •{' '}
                  {language === 'hi-IN'
                    ? 'अन्य रिमोट डिवाइस'
                    : 'Other Remote Devices'}
                </li>
              </ul>
            </div>

            <div className='flex gap-2 mb-4'>
              <button
                onClick={() => setLanguage('en-US')}
                className={`px-3 py-1 border-2 rounded text-xs font-bold transition-all ${
                  language === 'en-US'
                    ? 'border-orange-400 text-orange-400 bg-orange-400/10'
                    : 'border-gray-500 text-gray-400 hover:border-gray-400'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('hi-IN')}
                className={`px-3 py-1 border-2 rounded text-xs font-bold transition-all ${
                  language === 'hi-IN'
                    ? 'border-orange-400 text-orange-400 bg-orange-400/10'
                    : 'border-gray-500 text-gray-400 hover:border-gray-400'
                }`}
              >
                हिं
              </button>
            </div>

            <button
              onClick={connectToNetwork}
              disabled={!isConnected}
              className='w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed border-4 border-green-400 disabled:border-gray-400 text-white font-bold py-4 rounded transition-all flex items-center justify-center gap-3 text-lg'
            >
              <Link className='w-6 h-6' />
              {!isConnected
                ? language === 'hi-IN'
                  ? 'सर्वर से कनेक्ट हो रहा है...'
                  : 'CONNECTING TO SERVER...'
                : language === 'hi-IN'
                ? 'एमसीआर नेटवर्क से कनेक्ट करें'
                : 'CONNECT TO MCR NETWORK'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='h-screen bg-gray-900 text-white overflow-hidden'>
      {/* Device Frame */}
      <div className='max-w-md mx-auto bg-gray-800 border-4 border-green-500 rounded-lg shadow-2xl h-full flex flex-col'>
        {/* Header */}
        <div className='bg-gray-700 p-3 border-b-4 border-green-400 flex-shrink-0'>
          <div className='flex items-center justify-between mb-2'>
            <div className='flex items-center gap-2'>
              <Radio className='w-6 h-6 text-green-400' />
              <h1 className='text-xl font-bold text-green-400'>
                MCR REMOTE CONTROL
              </h1>
            </div>
            <div className='flex items-center gap-2'>
              <div
                className={`bg-green-600 text-green-100 border-2 border-green-400 px-3 py-1 rounded font-bold text-sm flex items-center gap-1 ${
                  !isConnected ? 'opacity-50' : ''
                }`}
              >
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

          {/* Status Bar */}
          <div className='flex items-center justify-between text-xs mt-2 mb-1'>
            <div className='flex items-center gap-2 text-gray-300'>
              <div className='flex items-center gap-1'>
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-400' : 'bg-red-400'
                  }`}
                ></div>
                {isConnected ? 'ONLINE' : 'OFFLINE'}
              </div>
              <span>•</span>
              <div className='flex items-center gap-1'>
                <MessageSquare className='w-3 h-3' />
                {relevantMessages.length}
              </div>
              <span>•</span>
              <div className='flex items-center gap-1'>
                <Users className='w-3 h-3' />
                {connectedDevices.length}
              </div>
            </div>
            <div className='text-gray-400 font-mono text-xs'>
              {new Date().toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>

          <div className='flex gap-2 mt-2'>
            <button
              onClick={() => setLanguage('en-US')}
              className={`px-3 py-1 border-2 rounded text-xs font-bold transition-all ${
                language === 'en-US'
                  ? 'border-orange-400 text-orange-400 bg-orange-400/10'
                  : 'border-gray-500 text-gray-400 hover:border-gray-400'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('hi-IN')}
              className={`px-3 py-1 border-2 rounded text-xs font-bold transition-all ${
                language === 'hi-IN'
                  ? 'border-orange-400 text-orange-400 bg-orange-400/10'
                  : 'border-gray-500 text-gray-400 hover:border-gray-400'
              }`}
            >
              हिं
            </button>
          </div>
        </div>

        {/* Content */}
        <div className='p-2 space-y-2 flex-1 overflow-y-auto'>
          {/* Quick Commands */}
          <div className='bg-gray-900 border-2 border-green-400/30 rounded-lg p-3 mb-3'>
            <h3 className='text-green-400 text-sm font-bold mb-3'>
              {language === 'hi-IN' ? '⚡ त्वरित आदेश' : '⚡ QUICK COMMANDS'}
            </h3>
            <div className='grid grid-cols-2 gap-2'>
              {MCR_COMMANDS.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => sendCommandMessage(cmd)}
                    disabled={isTransmitting || !isConnected}
                    className={`h-16 text-xs font-bold border-2 transition-all rounded flex flex-col items-center justify-center gap-1 ${
                      cmd.color === 'green'
                        ? 'bg-green-600 hover:bg-green-700 border-green-400 text-green-100'
                        : cmd.color === 'blue'
                        ? 'bg-blue-600 hover:bg-blue-700 border-blue-400 text-blue-100'
                        : cmd.color === 'amber'
                        ? 'bg-amber-600 hover:bg-amber-700 border-amber-400 text-amber-100'
                        : 'bg-red-600 hover:bg-red-700 border-red-400 text-red-100'
                    } ${
                      isTransmitting || !isConnected
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                  >
                    <Icon className='w-4 h-4' />
                    <span>{cmd.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manual Text Input */}
          <div className='bg-gray-900 border-2 border-blue-400/30 rounded-lg p-2'>
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

          {/* Voice Input */}
          <div className='bg-gray-900 border-2 border-blue-400/30 rounded-lg p-3 mb-3'>
            <h3 className='text-blue-400 text-sm font-bold mb-3'>
              {language === 'hi-IN' ? '🎙️ आवाज़ इनपुट' : '🎙️ VOICE INPUT'}
            </h3>
            <SpeechToTextButton
              onTranscript={handleVoiceTranscript}
              language={language}
              disabled={isTransmitting || !isConnected}
            />
          </div>

          {/* Message History */}
          <div className='bg-gray-900 border-2 border-amber-400/30 rounded-lg p-3 flex-1 flex flex-col'>
            <div className='flex justify-between items-center mb-3'>
              <h3 className='text-amber-400 text-sm font-bold'>
                {language === 'hi-IN'
                  ? '📨 संदेश इतिहास'
                  : '📨 MESSAGE HISTORY'}
              </h3>
              <div className='text-xs text-gray-400'>
                {relevantMessages.length}{' '}
                {language === 'hi-IN' ? 'संदेश' : 'messages'}
              </div>
            </div>
            <div className='space-y-2 flex-1 overflow-y-auto'>
              {relevantMessages.map((msg, index) => (
                <div
                  key={`${msg.id}-${index}`}
                  className={`p-3 rounded-lg border-2 text-xs ${
                    msg.source === 'MCR-REMOTE'
                      ? 'bg-green-900/30 border-green-400/30 text-green-300'
                      : msg.type === 'emergency'
                      ? 'bg-red-900/30 border-red-400/30 text-red-300'
                      : 'bg-blue-900/30 border-blue-400/30 text-blue-300'
                  }`}
                >
                  <div className='flex justify-between items-start mb-2'>
                    <div>
                      <div className='font-bold text-xs mb-1'>
                        {msg.source === 'MCR-REMOTE'
                          ? language === 'hi-IN'
                            ? 'आप'
                            : 'YOU'
                          : msg.source}
                        {msg.type === 'emergency' && (
                          <span className='ml-2 text-red-300'>
                            <AlertTriangle className='inline w-3 h-3' />
                          </span>
                        )}
                      </div>
                      <div className='text-xs opacity-70 mb-1'>
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                    <div className='flex gap-1'>
                      {msg.source !== 'MCR-REMOTE' && (
                        <button
                          onClick={() => acknowledgeMessage(msg.id)}
                          disabled={isTransmitting || !isConnected}
                          className='p-1 rounded hover:bg-white/10 disabled:opacity-50'
                          title={
                            language === 'hi-IN' ? 'पुष्टि करें' : 'Acknowledge'
                          }
                        >
                          <CheckCircle className='w-3 h-3 text-green-400' />
                        </button>
                      )}
                      <button
                        onClick={() => speakText(msg.text)}
                        disabled={!speechSupported}
                        className='p-1 rounded hover:bg-white/10 disabled:opacity-50'
                        title={language === 'hi-IN' ? 'बोलें' : 'Speak'}
                      >
                        <Volume2 className='w-3 h-3' />
                      </button>
                    </div>
                  </div>
                  <p className='font-mono text-sm'>{msg.text}</p>
                </div>
              ))}
              {relevantMessages.length === 0 && (
                <div className='h-full flex items-center justify-center text-center text-gray-500 py-4 text-xs'>
                  {language === 'hi-IN'
                    ? 'अभी तक कोई संदेश नहीं'
                    : 'No messages yet'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className='bg-gray-700 p-3 rounded-b-lg border-t-2 border-gray-600'>
          <div className='flex items-center justify-center gap-2 text-xs'>
            <div
              className={`w-2 h-2 rounded-full ${
                isTransmitting
                  ? 'bg-orange-400 animate-pulse'
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
