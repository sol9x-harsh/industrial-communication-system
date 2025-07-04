"use client"

import { useState } from "react"
import { AlertTriangle, Zap } from "lucide-react"

interface EmergencyButtonProps {
  onEmergencyActivate: () => void
  disabled?: boolean
  language?: string
}

export function EmergencyButton({ onEmergencyActivate, disabled = false, language = "en-US" }: EmergencyButtonProps) {
  const [isArmed, setIsArmed] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const handleArmEmergency = () => {
    setIsArmed(true)
    setCountdown(3)

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setIsArmed(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleEmergencyActivate = () => {
    if (isArmed) {
      onEmergencyActivate()
      setIsArmed(false)
      setCountdown(0)
    }
  }

  const handleCancel = () => {
    setIsArmed(false)
    setCountdown(0)
  }

  return (
    <div className="bg-red-900 border-4 border-red-600 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <Zap className="w-6 h-6 text-red-400" />
        <h3 className="text-red-400 text-lg font-bold">
          🚨 {language === "hi-IN" ? "आपातकालीन अलर्ट सिस्टम" : "EMERGENCY ALERT SYSTEM"}
        </h3>
      </div>

      {!isArmed ? (
        <div className="space-y-4">
          <div className="text-red-300 text-sm bg-red-800/50 border border-red-600 rounded p-3">
            <strong>{language === "hi-IN" ? "चेतावनी:" : "WARNING:"}</strong>{" "}
            {language === "hi-IN"
              ? "यह इंजन रूम में आपातकालीन बज़र और फ्लैशिंग अलर्ट सक्रिय करेगा। केवल गंभीर स्थितियों के लिए उपयोग करें।"
              : "This will activate emergency buzzer and flashing alerts in the engine room. Use only for critical situations."}
          </div>

          <button
            onClick={handleArmEmergency}
            disabled={disabled}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed border-4 border-red-400 text-white font-bold py-4 rounded transition-all flex items-center justify-center gap-3 text-lg"
          >
            <AlertTriangle className="w-6 h-6" />
            {language === "hi-IN" ? "आपातकालीन अलर्ट सक्रिय करें" : "ARM EMERGENCY ALERT"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-red-400 text-3xl font-bold font-mono animate-pulse mb-2">{countdown}</div>
            <div className="text-red-300 text-sm">
              {language === "hi-IN"
                ? "आपातकालीन अलर्ट ट्रिगर करने के लिए ACTIVATE पर क्लिक करें"
                : "Click ACTIVATE to trigger emergency alert"}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleEmergencyActivate}
              className="flex-1 bg-red-500 hover:bg-red-600 border-4 border-red-300 text-white font-bold py-4 rounded transition-all animate-pulse text-lg"
            >
              🚨 {language === "hi-IN" ? "आपातकाल सक्रिय करें" : "ACTIVATE EMERGENCY"}
            </button>

            <button
              onClick={handleCancel}
              className="px-6 bg-gray-600 hover:bg-gray-700 border-2 border-gray-400 text-white font-bold py-4 rounded transition-all"
            >
              {language === "hi-IN" ? "रद्द करें" : "CANCEL"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
