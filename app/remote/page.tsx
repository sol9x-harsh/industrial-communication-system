"use client"

import { useState, useEffect, useCallback } from "react"
import { Send, Volume2, Radio, Zap, AlertTriangle, CheckCircle, Settings, Wifi, Link, WifiOff } from "lucide-react"
import { SpeechToTextButton } from "@/components/SpeechToTextButton"
import { useWebSocket } from "@/hooks/useWebSocket"

const PREDEFINED_COMMANDS = [
  {
    id: "cmd1",
    label: "CONFIRM",
    text: "Task confirmed and completed successfully",
    icon: CheckCircle,
    color: "green",
  },
  {
    id: "cmd2",
    label: "MAINTENANCE",
    text: "Maintenance work completed",
    icon: Settings,
    color: "blue",
  },
  {
    id: "cmd3",
    label: "ALERT",
    text: "Alert condition detected - assistance needed",
    icon: AlertTriangle,
    color: "amber",
  },
  {
    id: "cmd4",
    label: "EMERGENCY",
    text: "EMERGENCY - Immediate assistance required",
    icon: Zap,
    color: "red",
  },
]

export default function RemoteDevice() {
  const [deviceId, setDeviceId] = useState<"A" | "B">("A")
  const [isDeviceConnected, setIsDeviceConnected] = useState(false)
  const [manualText, setManualText] = useState("")
  const [isTransmitting, setIsTransmitting] = useState(false)
  const [language, setLanguage] = useState<"en-US" | "hi-IN">("en-US")
  const [speechSupported, setSpeechSupported] = useState(false)

  // WebSocket connection
  const { isConnected, connectedDevices, messages, sendMessage, registerDevice } = useWebSocket()

  // Filter messages for this device
  const relevantMessages = messages
    .filter(
      (m) =>
        m.channel === "mcr-to-engine" ||
        m.channel === "emergency-broadcast" ||
        m.source === "MCR" ||
        m.source === `REMOTE-${deviceId === "A" ? "B" : "A"}` ||
        m.source === "HANDHELD",
    )
    .slice(-6)

  // Check speech synthesis support
  const checkSpeechSupport = useCallback(() => {
    if (typeof window !== "undefined") {
      const hasSynthesis = "speechSynthesis" in window
      setSpeechSupported(hasSynthesis)
      return hasSynthesis
    }
    return false
  }, [])

  // Connect to network
  const connectToNetwork = useCallback(() => {
    if (isConnected) {
      const deviceInfo = {
        id: `REMOTE-${deviceId}`,
        name: `Remote Device ${deviceId}`,
        type: "remote" as const,
        language,
      }

      registerDevice(deviceInfo)
      setIsDeviceConnected(true)

      // Send connection message
      setTimeout(() => {
        sendMessage({
          text: `Remote Device ${deviceId} connected to network`,
          channel: "device-status",
          source: `REMOTE-${deviceId}`,
          type: "normal",
        })
      }, 1000)
    }
  }, [isConnected, deviceId, language, registerDevice, sendMessage])

  // Disconnect from network
  const disconnectFromNetwork = useCallback(() => {
    setIsDeviceConnected(false)
    localStorage.removeItem("deviceInfo")
  }, [])

  // Send message
  const handleSendMessage = useCallback(
    (text: string, type: "emergency" | "normal" = "normal") => {
      if (!text.trim() || !isDeviceConnected) return

      setIsTransmitting(true)

      sendMessage({
        text: text.trim(),
        channel: "remote-broadcast",
        source: `REMOTE-${deviceId}`,
        type,
      })

      setTimeout(() => setIsTransmitting(false), 500)
    },
    [deviceId, isDeviceConnected, sendMessage],
  )

  // Text to speech
  const speakText = useCallback(
    (text: string) => {
      if (!speechSupported || !text.trim()) return

      try {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel()

          const utterance = new SpeechSynthesisUtterance(text)
          utterance.lang = language
          utterance.rate = 0.9
          utterance.volume = 1

          window.speechSynthesis.speak(utterance)
        }
      } catch (error) {
        console.error("TTS error:", error)
      }
    },
    [speechSupported, language],
  )

  // Handle voice transcript
  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      if (transcript.trim()) {
        handleSendMessage(transcript)
      }
    },
    [handleSendMessage],
  )

  // Send manual message
  const sendManualMessage = useCallback(() => {
    if (manualText.trim()) {
      handleSendMessage(manualText)
      setManualText("")
    }
  }, [manualText, handleSendMessage])

  // Send command message
  const sendCommandMessage = useCallback(
    (command: (typeof PREDEFINED_COMMANDS)[0]) => {
      const messageText = `${command.label}: ${command.text}`
      handleSendMessage(messageText, command.id === "cmd4" ? "emergency" : "normal")
    },
    [handleSendMessage],
  )

  // Format time
  const formatTime = useCallback((timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [])

  // Get color classes
  const getColorClasses = useCallback((color: string) => {
    switch (color) {
      case "green":
        return "bg-green-600 hover:bg-green-700 border-green-400 text-green-100"
      case "blue":
        return "bg-blue-600 hover:bg-blue-700 border-blue-400 text-blue-100"
      case "amber":
        return "bg-amber-600 hover:bg-amber-700 border-amber-400 text-amber-100"
      case "red":
        return "bg-red-600 hover:bg-red-700 border-red-400 text-red-100"
      default:
        return "bg-gray-600 hover:bg-gray-700 border-gray-400 text-gray-100"
    }
  }, [])

  // Initialize device ID from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const device = urlParams.get("device") as "A" | "B"
    if (device === "A" || device === "B") {
      setDeviceId(device)
    }
    checkSpeechSupport()
  }, [checkSpeechSupport])

  // Auto-connect if previously connected
  useEffect(() => {
    if (isConnected && !isDeviceConnected) {
      const savedDeviceInfo = localStorage.getItem("deviceInfo")
      if (savedDeviceInfo) {
        try {
          const deviceInfo = JSON.parse(savedDeviceInfo)
          if (deviceInfo.id === `REMOTE-${deviceId}`) {
            setIsDeviceConnected(true)
          }
        } catch (error) {
          console.error("Error parsing saved device info:", error)
        }
      }
    }
  }, [isConnected, isDeviceConnected, deviceId])

  if (!isDeviceConnected) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="max-w-md mx-auto bg-gray-800 border-4 border-gray-600 rounded-lg shadow-2xl p-8">
          <div className="text-center">
            <Radio className="w-16 h-16 text-orange-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-orange-400 mb-2">REMOTE-{deviceId}</h1>

            {/* Connection Status */}
            <div className="mb-4">
              <div
                className={`flex items-center justify-center gap-2 text-sm ${isConnected ? "text-green-400" : "text-red-400"}`}
              >
                {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                {isConnected ? "WebSocket Connected" : "Connecting to Server..."}
              </div>
            </div>

            <p className="text-gray-400 mb-6">
              {language === "hi-IN"
                ? "नेटवर्क से कनेक्ट करने के लिए कनेक्ट बटन दबाएं"
                : "Press CONNECT to join the communication network"}
            </p>

            <div className="mb-6 p-4 bg-gray-900 border-2 border-gray-600 rounded">
              <h3 className="text-sm font-bold text-gray-400 mb-2">
                {language === "hi-IN" ? "कनेक्ट होने पर आप जुड़ेंगे:" : "You will connect to:"}
              </h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• {language === "hi-IN" ? "एमसीआर कंट्रोल पैनल" : "MCR Control Panel"}</li>
                <li>• {language === "hi-IN" ? "इंजन रूम डिस्प्ले" : "Engine Room Display"}</li>
                <li>• {language === "hi-IN" ? "अन्य रिमोट डिवाइस" : "Other Remote Devices"}</li>
              </ul>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setLanguage("en-US")}
                className={`px-3 py-1 border-2 rounded text-xs font-bold transition-all ${
                  language === "en-US"
                    ? "border-orange-400 text-orange-400 bg-orange-400/10"
                    : "border-gray-500 text-gray-400 hover:border-gray-400"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage("hi-IN")}
                className={`px-3 py-1 border-2 rounded text-xs font-bold transition-all ${
                  language === "hi-IN"
                    ? "border-orange-400 text-orange-400 bg-orange-400/10"
                    : "border-gray-500 text-gray-400 hover:border-gray-400"
                }`}
              >
                हिं
              </button>
            </div>

            <button
              onClick={connectToNetwork}
              disabled={!isConnected}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed border-4 border-green-400 disabled:border-gray-400 text-white font-bold py-4 rounded transition-all flex items-center justify-center gap-3 text-lg"
            >
              <Link className="w-6 h-6" />
              {!isConnected
                ? language === "hi-IN"
                  ? "सर्वर से कनेक्ट हो रहा है..."
                  : "CONNECTING TO SERVER..."
                : language === "hi-IN"
                  ? "नेटवर्क से कनेक्ट करें"
                  : "CONNECT TO NETWORK"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Device Frame */}
      <div className="max-w-md mx-auto bg-gray-800 border-4 border-gray-600 rounded-lg shadow-2xl">
        {/* Header */}
        <div className="bg-gray-700 p-4 rounded-t-lg border-b-4 border-orange-400">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-6 h-6 text-orange-400" />
              <h1 className="text-xl font-bold text-orange-400">REMOTE-{deviceId}</h1>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`bg-green-600 text-green-100 border-2 border-green-400 px-3 py-1 rounded font-bold text-sm flex items-center gap-1 ${!isConnected ? "opacity-50" : ""}`}
              >
                <Wifi className="w-3 h-3" />
                {language === "hi-IN" ? "जुड़ा हुआ" : "CONNECTED"}
              </div>
              <button
                onClick={disconnectFromNetwork}
                className="bg-red-600 hover:bg-red-700 border-2 border-red-400 text-white px-2 py-1 rounded text-xs"
              >
                {language === "hi-IN" ? "डिस्कनेक्ट" : "DISCONNECT"}
              </button>
            </div>
          </div>

          {/* Connected Devices */}
          <div className="text-xs text-gray-300">
            {language === "hi-IN" ? "जुड़े डिवाइस:" : "Connected:"} {connectedDevices.length}
            {connectedDevices.length > 0 && (
              <span className="ml-2">({connectedDevices.map((d) => d.name).join(", ")})</span>
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setLanguage("en-US")}
              className={`px-3 py-1 border-2 rounded text-xs font-bold transition-all ${
                language === "en-US"
                  ? "border-orange-400 text-orange-400 bg-orange-400/10"
                  : "border-gray-500 text-gray-400 hover:border-gray-400"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("hi-IN")}
              className={`px-3 py-1 border-2 rounded text-xs font-bold transition-all ${
                language === "hi-IN"
                  ? "border-orange-400 text-orange-400 bg-orange-400/10"
                  : "border-gray-500 text-gray-400 hover:border-gray-400"
              }`}
            >
              हिं
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Voice Input */}
          <div className="bg-gray-900 border-2 border-green-400/30 rounded-lg p-4">
            <h3 className="text-green-400 text-sm font-bold mb-3">
              {language === "hi-IN" ? "🎙️ आवाज़ इनपुट" : "🎙️ VOICE INPUT"}
            </h3>
            <SpeechToTextButton
              onTranscript={handleVoiceTranscript}
              language={language}
              disabled={isTransmitting || !isConnected}
            />
          </div>

          {/* Manual Text Input */}
          <div className="bg-gray-900 border-2 border-blue-400/30 rounded-lg p-4">
            <h3 className="text-blue-400 text-sm font-bold mb-3">
              {language === "hi-IN" ? "✍️ टेक्स्ट इनपुट" : "✍️ TEXT INPUT"}
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={language === "hi-IN" ? "संदेश टाइप करें..." : "Type message..."}
                className="w-full bg-gray-800 border-2 border-blue-400/30 text-blue-300 text-sm p-2 rounded focus:outline-none focus:border-blue-400"
                onKeyDown={(e) => e.key === "Enter" && sendManualMessage()}
                disabled={!isConnected}
              />
              <button
                onClick={sendManualMessage}
                disabled={!manualText.trim() || isTransmitting || !isConnected}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-400 text-sm font-bold py-2 rounded transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {language === "hi-IN" ? "भेजें" : "SEND"}
              </button>
            </div>
          </div>

          {/* Predefined Commands */}
          <div className="bg-gray-900 border-2 border-amber-400/30 rounded-lg p-4">
            <h3 className="text-amber-400 text-sm font-bold mb-3">
              {language === "hi-IN" ? "🔘 त्वरित कमांड" : "🔘 QUICK COMMANDS"}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {PREDEFINED_COMMANDS.map((cmd) => {
                const Icon = cmd.icon
                return (
                  <button
                    key={cmd.id}
                    onClick={() => sendCommandMessage(cmd)}
                    disabled={isTransmitting || !isConnected}
                    className={`h-16 text-xs font-bold border-2 transition-all rounded flex flex-col items-center justify-center gap-1 ${getColorClasses(
                      cmd.color,
                    )} ${isTransmitting || !isConnected ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>
                      {language === "hi-IN" && cmd.id === "cmd1"
                        ? "पुष्टि"
                        : language === "hi-IN" && cmd.id === "cmd2"
                          ? "रखरखाव"
                          : language === "hi-IN" && cmd.id === "cmd3"
                            ? "चेतावनी"
                            : language === "hi-IN" && cmd.id === "cmd4"
                              ? "आपातकाल"
                              : cmd.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Message History */}
          <div className="bg-gray-900 border-2 border-gray-600 rounded-lg p-4">
            <h3 className="text-gray-400 text-sm font-bold mb-3">
              {language === "hi-IN" ? "संदेश इतिहास" : "MESSAGE HISTORY"}
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {relevantMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2 rounded border-2 text-xs ${
                    msg.source === `REMOTE-${deviceId}`
                      ? "bg-green-900/30 border-green-400/30 text-green-300"
                      : msg.type === "emergency"
                        ? "bg-red-900/30 border-red-400/30 text-red-300"
                        : "bg-blue-900/30 border-blue-400/30 text-blue-300"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs opacity-70">
                      {msg.source} - {formatTime(msg.timestamp)}
                    </span>
                    <button
                      onClick={() => speakText(msg.text)}
                      disabled={!speechSupported}
                      className="p-1 rounded hover:bg-white/10 disabled:opacity-50"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="font-mono">{msg.text}</p>
                </div>
              ))}
              {relevantMessages.length === 0 && (
                <div className="text-center text-gray-500 py-4 text-xs">
                  {language === "hi-IN" ? "अभी तक कोई संदेश नहीं" : "No messages yet"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-gray-700 p-3 rounded-b-lg border-t-2 border-gray-600">
          <div className="flex items-center justify-center gap-2 text-xs">
            <div
              className={`w-2 h-2 rounded-full ${
                isTransmitting ? "bg-orange-400 animate-pulse" : isConnected ? "bg-green-400" : "bg-red-400"
              }`}
            ></div>
            <span className="text-gray-300 font-mono">
              {isTransmitting
                ? language === "hi-IN"
                  ? "भेज रहा है..."
                  : "TRANSMITTING..."
                : isConnected
                  ? language === "hi-IN"
                    ? "तैयार"
                    : "READY"
                  : language === "hi-IN"
                    ? "कनेक्ट नहीं है"
                    : "DISCONNECTED"}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
