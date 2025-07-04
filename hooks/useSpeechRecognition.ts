"use client"

import { useState, useRef, useCallback, useEffect } from "react"

interface SpeechRecognitionHook {
  transcript: string
  isListening: boolean
  isSupported: boolean
  startListening: () => Promise<void>
  stopListening: () => void
  resetTranscript: () => void
  error: string | null
  browserInfo: string
}

export function useSpeechRecognition(language = "en-US"): SpeechRecognitionHook {
  const [transcript, setTranscript] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [browserInfo, setBrowserInfo] = useState("")

  const recognitionRef = useRef<any>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Detect browser type
  const detectBrowser = useCallback(() => {
    if (typeof window === "undefined") return "Unknown"

    const userAgent = navigator.userAgent
    let browser = "Unknown"

    if (userAgent.includes("Chrome") && userAgent.includes("Brave")) {
      browser = "Brave"
    } else if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
      browser = "Chrome"
    } else if (userAgent.includes("Edg")) {
      browser = "Edge"
    } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
      browser = "Safari"
    } else if (userAgent.includes("Firefox")) {
      browser = "Firefox"
    }

    console.log("Detected browser:", browser)
    console.log("User Agent:", userAgent)
    setBrowserInfo(browser)
    return browser
  }, [])

  // Check if speech recognition is supported
  const checkSupport = useCallback(() => {
    if (typeof window === "undefined") return false

    const browser = detectBrowser()
    const hasWebkitSpeech = "webkitSpeechRecognition" in window
    const hasSpeech = "SpeechRecognition" in window
    const hasMediaDevices = "mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices
    const isSecureContext = window.isSecureContext || location.protocol === "https:"

    console.log("Speech Recognition Support Check:", {
      browser,
      webkitSpeechRecognition: hasWebkitSpeech,
      SpeechRecognition: hasSpeech,
      mediaDevices: hasMediaDevices,
      isSecureContext,
      location: window.location.href,
    })

    // Special handling for Brave browser
    if (browser === "Brave") {
      console.log("Brave browser detected - checking privacy settings...")

      // Brave often blocks speech recognition by default
      if (!hasWebkitSpeech && !hasSpeech) {
        setError(
          "Brave browser detected. Please enable speech recognition in Brave settings:\n1. Go to brave://settings/privacy\n2. Turn OFF 'Block fingerprinting'\n3. Refresh this page",
        )
        return false
      }
    }

    const isSupported = (hasWebkitSpeech || hasSpeech) && hasMediaDevices && isSecureContext

    if (!isSupported) {
      let errorMsg = "Speech recognition not available. "
      if (!isSecureContext) {
        errorMsg += "HTTPS required. "
      }
      if (!hasMediaDevices) {
        errorMsg += "Microphone API not available. "
      }
      if (!hasWebkitSpeech && !hasSpeech) {
        errorMsg += `${browser} browser may not support speech recognition.`
      }
      setError(errorMsg)
    }

    return isSupported
  }, [detectBrowser])

  // Initialize speech recognition
  const initializeRecognition = useCallback(() => {
    if (!isSupported) return

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (!SpeechRecognition) {
        console.error("SpeechRecognition constructor not available")
        setError("Speech recognition constructor not found")
        return
      }

      recognitionRef.current = new SpeechRecognition()

      // Configure recognition with Brave-friendly settings
      recognitionRef.current.continuous = false // Set to false for better Brave compatibility
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = language
      recognitionRef.current.maxAlternatives = 1

      // Event handlers
      recognitionRef.current.onstart = () => {
        console.log("Speech recognition started successfully")
        setIsListening(true)
        setError(null)
      }

      recognitionRef.current.onresult = (event: any) => {
        console.log("Speech recognition result received:", event)

        let finalTranscript = ""
        let interimTranscript = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const transcript = result[0].transcript

          if (result.isFinal) {
            finalTranscript += transcript + " "
          } else {
            interimTranscript += transcript
          }
        }

        const fullTranscript = (finalTranscript + interimTranscript).trim()
        console.log("Transcript update:", fullTranscript)
        setTranscript(fullTranscript)
      }

      recognitionRef.current.onend = () => {
        console.log("Speech recognition ended")
        setIsListening(false)
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event)
        setIsListening(false)

        let errorMessage = "Speech recognition error"

        switch (event.error) {
          case "no-speech":
            errorMessage = "No speech detected. Please speak louder and try again."
            break
          case "audio-capture":
            errorMessage = "Microphone not accessible. Check if another app is using it."
            break
          case "not-allowed":
            if (browserInfo === "Brave") {
              errorMessage =
                "Microphone blocked by Brave. Go to brave://settings/content/microphone and allow this site."
            } else {
              errorMessage = "Microphone permission denied. Click the microphone icon in your address bar."
            }
            break
          case "network":
            errorMessage = "Network error. Speech recognition requires internet connection."
            break
          case "service-not-allowed":
            if (browserInfo === "Brave") {
              errorMessage = "Speech service blocked by Brave privacy settings. Try disabling 'Block fingerprinting'."
            } else {
              errorMessage = "Speech service not allowed. Try using HTTPS."
            }
            break
          case "bad-grammar":
            errorMessage = "Speech recognition grammar error."
            break
          case "language-not-supported":
            errorMessage = `Language '${language}' not supported.`
            break
          default:
            errorMessage = `Speech recognition error: ${event.error}`
        }

        setError(errorMessage)
      }

      recognitionRef.current.onnomatch = () => {
        console.log("No speech match found")
        setError("Speech not recognized. Please try speaking more clearly.")
      }

      console.log("Speech recognition initialized successfully")
    } catch (error) {
      console.error("Failed to initialize speech recognition:", error)
      setError(`Failed to initialize speech recognition: ${error}`)
    }
  }, [isSupported, language, browserInfo])

  // Request microphone permission with Brave-specific handling
  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      console.log("Requesting microphone permission...")

      // For Brave, we need to be more explicit about permissions
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Brave-specific: be more explicit about audio requirements
          sampleRate: 44100,
          channelCount: 1,
        },
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log("Microphone permission granted")

      // Test audio levels to ensure microphone is working
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      source.connect(analyser)

      console.log("Audio context created successfully")

      // Stop the stream and close audio context
      stream.getTracks().forEach((track) => track.stop())
      await audioContext.close()

      return true
    } catch (error) {
      console.error("Microphone permission error:", error)

      if (browserInfo === "Brave") {
        setError(
          "Microphone access denied in Brave. Please:\n1. Click the shield icon in address bar\n2. Allow microphone access\n3. Or go to brave://settings/content/microphone",
        )
      } else {
        setError("Microphone access denied. Please allow microphone access and try again.")
      }
      return false
    }
  }, [browserInfo])

  // Start listening with Brave-specific optimizations
  const startListening = useCallback(async () => {
    if (!isSupported) {
      if (browserInfo === "Brave") {
        setError(
          "Speech recognition blocked by Brave. Please:\n1. Go to brave://settings/privacy\n2. Set 'Block fingerprinting' to 'Standard'\n3. Refresh this page",
        )
      } else {
        setError("Speech recognition not supported in this browser")
      }
      return
    }

    if (isListening) {
      console.log("Already listening...")
      return
    }

    // Clear any previous errors
    setError(null)

    // Request microphone permission
    const hasPermission = await requestMicrophonePermission()
    if (!hasPermission) return

    try {
      if (!recognitionRef.current) {
        initializeRecognition()
      }

      if (recognitionRef.current) {
        console.log("Starting speech recognition...")
        recognitionRef.current.lang = language

        // For Brave, add a small delay before starting
        if (browserInfo === "Brave") {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        recognitionRef.current.start()

        // Set a timeout to automatically stop after 15 seconds (shorter for Brave)
        const timeoutDuration = browserInfo === "Brave" ? 15000 : 30000
        timeoutRef.current = setTimeout(() => {
          if (isListening) {
            stopListening()
            setError(`Speech recognition timed out after ${timeoutDuration / 1000} seconds`)
          }
        }, timeoutDuration)
      }
    } catch (error) {
      console.error("Error starting speech recognition:", error)
      setError("Failed to start speech recognition. Please try again.")
      setIsListening(false)
    }
  }, [isSupported, isListening, language, requestMicrophonePermission, initializeRecognition, browserInfo])

  // Stop listening
  const stopListening = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (recognitionRef.current && isListening) {
      try {
        console.log("Stopping speech recognition...")
        recognitionRef.current.stop()
      } catch (error) {
        console.error("Error stopping speech recognition:", error)
      }
    }

    setIsListening(false)
  }, [isListening])

  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript("")
    setError(null)
  }, [])

  // Initialize on mount
  useEffect(() => {
    const supported = checkSupport()
    setIsSupported(supported)

    if (supported) {
      initializeRecognition()
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }, [checkSupport, initializeRecognition])

  // Update language when it changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = language
    }
  }, [language])

  return {
    transcript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    error,
    browserInfo,
  }
}
