'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, AlertCircle, Shield, Settings } from 'lucide-react';

interface SpeechToTextButtonProps {
  onTranscript: (text: string) => void;
  language: string;
  disabled?: boolean;
  className?: string;
}

export function SpeechToTextButton({
  onTranscript,
  language,
  disabled = false,
  className = '',
}: SpeechToTextButtonProps) {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserInfo, setBrowserInfo] = useState('');
  const [confidence, setConfidence] = useState(0);

  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detect browser and check support
  const initializeSpeechRecognition = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Detect browser
    const userAgent = navigator.userAgent;
    let browser = 'Unknown';

    if (userAgent.includes('Chrome') && userAgent.includes('Brave')) {
      browser = 'Brave';
    } else if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = 'Chrome';
    } else if (userAgent.includes('Edg')) {
      browser = 'Edge';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'Safari';
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
    }

    setBrowserInfo(browser);

    // Check for speech recognition support
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const hasMediaDevices =
      'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
    const isSecureContext =
      window.isSecureContext || location.protocol === 'https:';

    console.log('Speech Recognition Check:', {
      browser,
      SpeechRecognition: !!SpeechRecognition,
      mediaDevices: hasMediaDevices,
      isSecureContext,
      language,
    });

    if (!SpeechRecognition) {
      setIsSupported(false);
      if (browser === 'Firefox') {
        setError(
          "Firefox doesn't support Web Speech API. Please use Chrome, Edge, Safari, or Brave."
        );
      } else {
        setError(`Speech recognition not supported in ${browser}`);
      }
      return;
    }

    if (!hasMediaDevices) {
      setIsSupported(false);
      setError('Microphone access not available');
      return;
    }

    if (!isSecureContext) {
      setIsSupported(false);
      setError('HTTPS required for speech recognition');
      return;
    }

    // Initialize speech recognition
    try {
      recognitionRef.current = new SpeechRecognition();

      // Configure recognition
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = language;
      recognitionRef.current.maxAlternatives = 1;

      // Event handlers
      recognitionRef.current.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
        setError(null);
        setTranscript('');
      };

      recognitionRef.current.onresult = (event: any) => {
        console.log('Speech recognition result:', event);

        let finalTranscript = '';
        let interimTranscript = '';
        let maxConfidence = 0;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence || 0;

          if (result.isFinal) {
            finalTranscript += transcript + ' ';
            maxConfidence = Math.max(maxConfidence, confidence);
          } else {
            interimTranscript += transcript;
          }
        }

        const fullTranscript = (finalTranscript + interimTranscript).trim();
        setTranscript(fullTranscript);
        setConfidence(maxConfidence);

        // Auto-submit if we have a final result with good confidence
        if (finalTranscript.trim() && maxConfidence > 0.7) {
          setTimeout(() => {
            if (finalTranscript.trim()) {
              onTranscript(finalTranscript.trim());
              setTranscript('');
              setIsListening(false);
            }
          }, 500);
        }
      };

      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event);
        setIsListening(false);

        let errorMessage = 'Speech recognition error';

        switch (event.error) {
          case 'no-speech':
            errorMessage =
              'No speech detected. Please speak clearly and try again.';
            break;
          case 'audio-capture':
            errorMessage =
              'Microphone not accessible. Check if another app is using it.';
            break;
          case 'not-allowed':
            if (browser === 'Brave') {
              errorMessage =
                'Microphone blocked by Brave. Click the shield icon and allow microphone access.';
            } else {
              errorMessage =
                'Microphone permission denied. Please allow microphone access.';
            }
            break;
          case 'network':
            errorMessage =
              'Network error. Speech recognition requires internet connection.';
            break;
          case 'service-not-allowed':
            if (browser === 'Brave') {
              errorMessage =
                "Speech service blocked by Brave. Go to brave://settings/privacy and set 'Block fingerprinting' to Standard.";
            } else {
              errorMessage = 'Speech service not allowed. Try using HTTPS.';
            }
            break;
          case 'language-not-supported':
            errorMessage = `Language '${language}' not supported. Try switching to English.`;
            break;
          default:
            errorMessage = `Speech recognition error: ${event.error}`;
        }

        setError(errorMessage);
      };

      setIsSupported(true);
      console.log('Speech recognition initialized successfully');
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      setIsSupported(false);
      setError(`Failed to initialize speech recognition: ${error}`);
    }
  }, [language, onTranscript]);

  // Request microphone permission
  const requestMicrophonePermission =
    useCallback(async (): Promise<boolean> => {
      try {
        console.log('Requesting microphone permission...');

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        console.log('Microphone permission granted');

        // Stop the stream immediately
        stream.getTracks().forEach((track) => track.stop());

        return true;
      } catch (error) {
        console.error('Microphone permission error:', error);

        if (browserInfo === 'Brave') {
          setError(
            'Microphone access denied in Brave. Click the shield icon in address bar and allow microphone access.'
          );
        } else {
          setError(
            'Microphone access denied. Please allow microphone access and try again.'
          );
        }

        return false;
      }
    }, [browserInfo]);

  // Start listening
  const startListening = useCallback(async () => {
    if (!isSupported) {
      setError('Speech recognition not supported');
      return;
    }

    if (isListening) {
      console.log('Already listening...');
      return;
    }

    // Clear any previous errors
    setError(null);
    setTranscript('');

    // Request microphone permission
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) return;

    try {
      if (recognitionRef.current) {
        console.log('Starting speech recognition...');
        recognitionRef.current.lang = language;
        recognitionRef.current.start();

        // Set timeout to stop after 10 seconds
        timeoutRef.current = setTimeout(() => {
          if (isListening) {
            stopListening();
            if (!transcript.trim()) {
              setError('No speech detected. Please try again.');
            }
          }
        }, 10000);
      }
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setError('Failed to start speech recognition. Please try again.');
      setIsListening(false);
    }
  }, [
    isSupported,
    isListening,
    language,
    requestMicrophonePermission,
    transcript,
  ]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (recognitionRef.current && isListening) {
      try {
        console.log('Stopping speech recognition...');
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }

    setIsListening(false);
  }, [isListening]);

  // Handle toggle listening
  const handleToggleListening = useCallback(async () => {
    if (isListening) {
      stopListening();
      // If we have transcript, use it
      if (transcript.trim()) {
        onTranscript(transcript.trim());
        setTranscript('');
      }
    } else {
      await startListening();
    }
  }, [isListening, stopListening, startListening, transcript, onTranscript]);

  // Handle use transcript
  const handleUseTranscript = useCallback(() => {
    if (transcript.trim()) {
      onTranscript(transcript.trim());
      setTranscript('');
    }
  }, [transcript, onTranscript]);

  // Handle clear transcript
  const handleClearTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  // Initialize on mount and language change
  useEffect(() => {
    initializeSpeechRecognition();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    };
  }, [initializeSpeechRecognition]);

  // Brave-specific help component
  const BraveHelp = () => (
    <div className='text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded p-3 mt-2'>
      <div className='flex items-center gap-2 mb-2'>
        <Shield className='w-4 h-4' />
        <strong>Brave Browser Setup Required</strong>
      </div>
      <div className='space-y-2'>
        <p>
          <strong>To enable speech recognition:</strong>
        </p>
        <ol className='list-decimal list-inside space-y-1 text-xs'>
          <li>
            Type{' '}
            <code className='bg-amber-400/20 px-1 rounded'>
              brave://settings/privacy
            </code>{' '}
            in address bar
          </li>
          <li>
            Set "Block fingerprinting" to <strong>Standard</strong> (not Strict)
          </li>
          <li>
            Go to{' '}
            <code className='bg-amber-400/20 px-1 rounded'>
              brave://settings/content/microphone
            </code>
          </li>
          <li>Add this site to "Allow" list</li>
          <li>Refresh this page</li>
        </ol>
        <p className='text-amber-300'>
          Or click the shield icon 🛡️ in your address bar and allow microphone
          access.
        </p>
      </div>
    </div>
  );

  if (!isSupported) {
    return (
      <div className='flex flex-col'>
        <div className='flex items-center gap-3'>
          <button
            disabled
            className='w-12 h-12 rounded-full border-2 border-red-400 bg-red-500/20 flex items-center justify-center opacity-50 cursor-not-allowed'
          >
            <MicOff className='w-5 h-5 text-red-400' />
          </button>
          <div className='flex-1 bg-gray-800 border-2 border-red-400/30 rounded p-2 min-h-[40px] text-xs'>
            <div className='text-red-400 flex items-center gap-2'>
              <AlertCircle className='w-4 h-4' />
              Speech recognition not available in {browserInfo} browser
            </div>
          </div>
        </div>

        {browserInfo === 'Brave' && <BraveHelp />}

        {browserInfo === 'Firefox' && (
          <div className='text-xs text-red-400 bg-red-400/10 border border-red-400/30 rounded p-3 mt-2'>
            <strong>Firefox Not Supported:</strong> Please use Chrome, Edge,
            Safari, or Brave browser for speech recognition.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-3'>
      {/* Browser and Language Info */}
      <div className='text-xs text-gray-400 flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Settings className='w-3 h-3' />
          Browser: {browserInfo} | Language:{' '}
          {language === 'hi-IN' ? 'हिंदी' : 'English'}
        </div>
        {confidence > 0 && (
          <div className='text-green-400'>
            Confidence: {Math.round(confidence * 100)}%
          </div>
        )}
      </div>

      <div className='flex items-center gap-3'>
        <button
          onClick={handleToggleListening}
          disabled={disabled}
          className={`w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center ${
            isListening
              ? 'bg-red-500 border-red-400 hover:bg-red-600 animate-pulse'
              : 'bg-green-600 border-green-400 hover:bg-green-700'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        >
          {isListening ? (
            <MicOff className='w-5 h-5' />
          ) : (
            <Mic className='w-5 h-5' />
          )}
        </button>

        <div className='flex-1'>
          <div className='bg-gray-800 border-2 border-green-400/30 rounded p-2 min-h-[40px] text-xs font-mono'>
            {error ? (
              <div className='text-red-400 flex items-start gap-2'>
                <AlertCircle className='w-4 h-4 mt-0.5 flex-shrink-0' />
                <div className='whitespace-pre-line'>{error}</div>
              </div>
            ) : transcript ? (
              <div className='text-green-300'>{transcript}</div>
            ) : isListening ? (
              <div className='text-green-400 animate-pulse'>
                🎤{' '}
                {language === 'hi-IN'
                  ? 'सुन रहा है... अब बोलें!'
                  : 'Listening... Speak now!'}
              </div>
            ) : (
              <div className='text-gray-400'>
                {language === 'hi-IN'
                  ? 'माइक दबाएं और बोलें'
                  : 'Tap mic to speak'}
              </div>
            )}
          </div>
        </div>
      </div>

      {transcript && !isListening && (
        <div className='flex gap-2'>
          <button
            onClick={handleUseTranscript}
            className='flex-1 bg-green-600 hover:bg-green-700 border-2 border-green-400 text-sm font-bold py-2 rounded transition-all'
          >
            {language === 'hi-IN' ? 'टेक्स्ट उपयोग करें' : 'USE TEXT'}
          </button>
          <button
            onClick={handleClearTranscript}
            className='px-4 bg-gray-600 hover:bg-gray-700 border-2 border-gray-400 text-sm font-bold py-2 rounded transition-all'
          >
            {language === 'hi-IN' ? 'साफ़ करें' : 'CLEAR'}
          </button>
        </div>
      )}

      {browserInfo === 'Brave' && error && <BraveHelp />}
    </div>
  );
}
