'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Volume2, VolumeX } from 'lucide-react';

interface EmergencyAlertProps {
  isActive: boolean;
  onStop: () => void;
}

export function EmergencyAlert({ isActive, onStop }: EmergencyAlertProps) {
  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Initialize audio context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }

    return () => {
      // Cleanup audio context
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
    };
  }, []);

  // Handle audio playback
  useEffect(() => {
    if (!isActive || isMuted) {
      stopAudio();
      return;
    }

    playBuzz();
    const interval = setInterval(playBuzz, 700);

    return () => {
      clearInterval(interval);
      stopAudio();
    };
  }, [isActive, isMuted]);

  const playBuzz = () => {
    if (!audioContextRef.current || isMuted) return;

    try {
      // Create oscillator
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();

      // Configure oscillator
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = 600;

      // Configure gain
      gainNode.gain.value = 0.8;

      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

      // Start oscillator
      oscillator.start();

      // Store references for cleanup
      oscillatorRef.current = oscillator;
      gainNodeRef.current = gainNode;

      // Schedule stop
      oscillator.stop(audioContextRef.current.currentTime + 0.6);
    } catch (error) {
      console.error('Error playing buzz:', error);
    }
  };

  const stopAudio = () => {
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (e) {
        console.error('Error stopping oscillator:', e);
      }
      oscillatorRef.current = null;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
  };

  if (!isActive) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-red-900/80 backdrop-blur-sm'>
      <div className='bg-red-600 border-4 border-red-400 rounded-lg p-8 text-center animate-pulse shadow-2xl max-w-md mx-4'>
        <div className='flex items-center justify-center mb-4'>
          <AlertTriangle className='w-16 h-16 text-white animate-bounce' />
        </div>

        <h2 className='text-3xl font-bold text-white mb-4 tracking-wider'>
          EMERGENCY ALERT
        </h2>

        <p className='text-white text-lg mb-6 font-mono'>
          CRITICAL SITUATION DETECTED
        </p>

        <div className='flex gap-4 justify-center'>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className='bg-yellow-600 hover:bg-yellow-700 border-2 border-yellow-400 text-black font-bold py-3 px-6 rounded transition-all flex items-center gap-2'
          >
            {isMuted ? (
              <VolumeX className='w-5 h-5' />
            ) : (
              <Volume2 className='w-5 h-5' />
            )}
            {isMuted ? 'UNMUTE' : 'MUTE'}
          </button>

          <button
            onClick={onStop}
            className='bg-red-800 hover:bg-red-900 border-2 border-red-600 text-white font-bold py-3 px-6 rounded transition-all'
          >
            STOP ALERT
          </button>
        </div>

        <div className='mt-4 text-sm text-red-200'>
          ⚠️ Emergency alert will auto-stop after 30 seconds
        </div>
      </div>
    </div>
  );
}
