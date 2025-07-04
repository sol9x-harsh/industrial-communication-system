'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Volume2, VolumeX } from 'lucide-react';

interface EmergencyAlertProps {
  isActive: boolean;
  onStop: () => void;
}

export function EmergencyAlert({ isActive, onStop }: EmergencyAlertProps) {
  const [isMuted, setIsMuted] = useState(false);

  // Simple audio buzz fallback
  const playBuzz = () => {
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 600; // Lower pitch = buzzy
      oscillator.type = 'sawtooth'; // More harsh and buzzy than 'square'
      gainNode.gain.value = isMuted ? 0 : 0.8; // Louder gain, closer to 110dB simulation

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.6); // Buzz for 600ms
    } catch (error) {
      console.log('Audio not available');
    }
  };

  useEffect(() => {
    if (isActive && !isMuted) {
      const interval = setInterval(playBuzz, 700);
      return () => clearInterval(interval);
    }
  }, [isActive, isMuted]);

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
