"use client"

import { useEffect, useState } from "react"

interface EngineRoomFlashingLEDProps {
  isEmergency: boolean
}

export function EngineRoomFlashingLED({ isEmergency }: EngineRoomFlashingLEDProps) {
  const [flashState, setFlashState] = useState(false)

  useEffect(() => {
    if (!isEmergency) {
      setFlashState(false)
      return
    }

    const interval = setInterval(() => {
      setFlashState((prev) => !prev)
    }, 200)

    return () => clearInterval(interval)
  }, [isEmergency])

  if (!isEmergency) return null

  return (
    <>
      {/* Full screen flash overlay */}
      <div
        className={`fixed inset-0 pointer-events-none z-40 transition-opacity duration-200 ${
          flashState ? "bg-red-500/30 opacity-100" : "opacity-0"
        }`}
      />

      {/* Emergency LED indicators */}
      <div className="fixed top-4 left-4 right-4 z-50 flex justify-center">
        <div className="bg-black border-4 border-red-600 rounded-lg p-4 flex items-center gap-4">
          <div
            className={`w-8 h-8 rounded-full border-4 border-red-400 transition-all duration-200 ${
              flashState ? "bg-red-500 shadow-red-500 shadow-2xl" : "bg-red-900"
            }`}
          />
          <div className="text-red-400 font-bold font-mono text-lg animate-pulse">EMERGENCY ALERT ACTIVE</div>
          <div
            className={`w-8 h-8 rounded-full border-4 border-red-400 transition-all duration-200 ${
              flashState ? "bg-red-500 shadow-red-500 shadow-2xl" : "bg-red-900"
            }`}
          />
        </div>
      </div>
    </>
  )
}
