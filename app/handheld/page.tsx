"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertTriangle, Wrench, AlertCircle, Wifi, WifiOff, Radio } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  text: string
  timestamp: string
  type: "sent" | "received"
  source?: string
}

const PRESET_MESSAGES = [
  {
    id: "confirm",
    text: "Task confirmed and completed successfully",
    icon: CheckCircle,
    color: "green",
    label: "CONFIRM",
  },
  {
    id: "help",
    text: "Assistance required in engine room",
    icon: AlertTriangle,
    color: "amber",
    label: "HELP NEEDED",
  },
  {
    id: "maintenance",
    text: "Maintenance work completed",
    icon: Wrench,
    color: "blue",
    label: "MAINTENANCE DONE",
  },
  {
    id: "emergency",
    text: "EMERGENCY - Immediate assistance required",
    icon: AlertCircle,
    color: "red",
    label: "EMERGENCY",
  },
]

export default function HandheldRemote() {
  const [isConnected, setIsConnected] = useState(true)
  const [lastSent, setLastSent] = useState<string>("")
  const [isTransmitting, setIsTransmitting] = useState(false)

  useEffect(() => {
    // Check connection status periodically
    const interval = setInterval(checkConnection, 3000)
    return () => clearInterval(interval)
  }, [])

  const checkConnection = async () => {
    try {
      await fetch("/api/messages")
      setIsConnected(true)
    } catch (error) {
      setIsConnected(false)
    }
  }

  const sendMessage = async (messageData: (typeof PRESET_MESSAGES)[0]) => {
    setIsTransmitting(true)

    const message: Message = {
      id: Date.now().toString(),
      text: messageData.text,
      timestamp: new Date().toISOString(),
      type: "received",
      source: "HANDHELD",
    }

    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      })

      setLastSent(messageData.label)
      setTimeout(() => setLastSent(""), 3000)
    } catch (error) {
      console.error("Failed to send message:", error)
    } finally {
      setTimeout(() => setIsTransmitting(false), 500)
    }
  }

  const getColorClasses = (color: string) => {
    switch (color) {
      case "green":
        return {
          bg: "bg-green-600 hover:bg-green-700 active:bg-green-800",
          border: "border-green-400",
          text: "text-green-100",
        }
      case "amber":
        return {
          bg: "bg-amber-600 hover:bg-amber-700 active:bg-amber-800",
          border: "border-amber-400",
          text: "text-amber-100",
        }
      case "blue":
        return {
          bg: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
          border: "border-blue-400",
          text: "text-blue-100",
        }
      case "red":
        return {
          bg: "bg-red-600 hover:bg-red-700 active:bg-red-800",
          border: "border-red-400",
          text: "text-red-100",
        }
      default:
        return {
          bg: "bg-gray-600 hover:bg-gray-700 active:bg-gray-800",
          border: "border-gray-400",
          text: "text-gray-100",
        }
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header */}
      <Card className="bg-gray-800 border-2 border-orange-400/50 mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Radio className="w-6 h-6 text-orange-400" />
              <CardTitle className="text-orange-400 text-lg">ENGINE ROOM REMOTE</CardTitle>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "border-2 font-semibold",
                isConnected ? "border-green-400 text-green-400" : "border-red-400 text-red-400",
              )}
            >
              {isConnected ? <Wifi className="w-4 h-4 mr-1" /> : <WifiOff className="w-4 h-4 mr-1" />}
              {isConnected ? "LINKED" : "NO SIGNAL"}
            </Badge>
          </div>
          {lastSent && <div className="mt-2 text-sm text-green-400 font-mono">✓ TRANSMITTED: {lastSent}</div>}
        </CardHeader>
      </Card>

      {/* Control Buttons */}
      <div className="grid grid-cols-1 gap-6 max-w-md mx-auto">
        {PRESET_MESSAGES.map((msg) => {
          const colors = getColorClasses(msg.color)
          const Icon = msg.icon

          return (
            <Button
              key={msg.id}
              onClick={() => sendMessage(msg)}
              disabled={isTransmitting || !isConnected}
              className={cn(
                "h-24 text-lg font-bold border-4 transition-all duration-200 transform active:scale-95",
                colors.bg,
                colors.border,
                colors.text,
                isTransmitting && "animate-pulse opacity-50",
                !isConnected && "opacity-50 cursor-not-allowed",
              )}
            >
              <div className="flex flex-col items-center gap-2">
                <Icon className="w-8 h-8" />
                <span>{msg.label}</span>
              </div>
            </Button>
          )
        })}
      </div>

      {/* Status Indicator */}
      <div className="fixed bottom-4 left-4 right-4">
        <Card className="bg-gray-800/90 border border-gray-600">
          <CardContent className="p-3">
            <div className="flex items-center justify-center gap-2 text-sm">
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  isTransmitting ? "bg-orange-400 animate-pulse" : isConnected ? "bg-green-400" : "bg-red-400",
                )}
              ></div>
              <span className="text-gray-300">
                {isTransmitting ? "TRANSMITTING..." : isConnected ? "READY TO TRANSMIT" : "CONNECTION LOST"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
