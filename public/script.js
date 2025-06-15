document.addEventListener("DOMContentLoaded", () => {
  const toggleButton = document.getElementById("toggleButton")
  const statusElement = document.getElementById("status")
  let mediaRecorder
  let audioChunks = []
  let socket
  let audioContext
  let localAudioSource // New variable for local audio playback
  const audioQueue = []
  let isPlaying = false

  // Import Socket.IO client library
  const io = window.io

  // Initialize Socket.IO connection
  try {
    socket = io() // Connects to the same host and port as the HTML served from
    console.log("Attempting to connect to Socket.IO server...")
  } catch (error) {
    console.error("Failed to initialize Socket.IO:", error)
    statusElement.textContent = "Error: Could not connect to server."
    toggleButton.disabled = true
    return
  }

  socket.on("connect", () => {
    console.log("Connected to Socket.IO server")
    statusElement.textContent = "Status: Connected, Idle"
    statusElement.classList.remove("status-recording")
    statusElement.classList.add("status-idle")
    toggleButton.disabled = false
  })

  socket.on("disconnect", () => {
    console.log("Disconnected from Socket.IO server")
    statusElement.textContent = "Status: Disconnected"
    statusElement.classList.remove("status-recording", "status-idle")
    toggleButton.disabled = true
  })

  socket.on("connect_error", (error) => {
    console.error("Socket.IO connection error:", error)
    statusElement.textContent = "Status: Connection Error"
    statusElement.classList.remove("status-recording", "status-idle")
    toggleButton.disabled = true
  })

  // Handle incoming audio chunks from other users
  socket.on("audioChunk", (chunk) => {
    console.log("Client: Received audio chunk from server, size:", chunk.byteLength)
    audioQueue.push(chunk)
    if (!isPlaying) {
      playNextAudioChunk()
    }
  })

  async function playNextAudioChunk() {
    if (audioQueue.length === 0) {
      isPlaying = false
      return
    }

    isPlaying = true
    const chunk = audioQueue.shift()
    const audioBlob = new Blob([chunk], { type: "audio/webm; codecs=opus" })

    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)()
    }

    try {
      const arrayBuffer = await audioBlob.arrayBuffer()
      console.log("Client: Decoding audio buffer...")
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      console.log("Client: Audio buffer decoded, playing...")
      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContext.destination)
      source.start(0)
      source.onended = () => {
        console.log("Client: Audio chunk finished playing.")
        playNextAudioChunk() // Play the next chunk when this one ends
      }
    } catch (e) {
      console.error("Client: Error decoding or playing audio:", e)
      playNextAudioChunk() // Try to play the next chunk even if this one failed
    }
  }

  toggleButton.addEventListener("click", async () => {
    if (toggleButton.textContent === "Start Voice Chat") {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm; codecs=opus" })

        // NEW: Play local microphone input back to the user
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)()
        }
        localAudioSource = audioContext.createMediaStreamSource(stream)
        localAudioSource.connect(audioContext.destination)
        console.log("Client: Local microphone audio connected to output.")

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data)
            // Send audio chunk immediately to the server
            socket.emit("audioChunk", event.data)
            console.log("Client: Sent audio chunk to server, size:", event.data.size)
          }
        }

        mediaRecorder.onstop = () => {
          // Clean up stream tracks
          stream.getTracks().forEach((track) => track.stop())
          // NEW: Disconnect local audio source when stopping
          if (localAudioSource) {
            localAudioSource.disconnect(audioContext.destination)
            localAudioSource = null
            console.log("Client: Local microphone audio disconnected.")
          }
          audioChunks = [] // Clear chunks after stopping
        }

        mediaRecorder.start(100) // Collect 100ms chunks
        toggleButton.textContent = "Stop Voice Chat"
        statusElement.textContent = "Status: Recording..."
        statusElement.classList.remove("status-idle")
        statusElement.classList.add("status-recording")
        console.log("Recording started.")
      } catch (err) {
        console.error("Error accessing microphone:", err)
        statusElement.textContent = "Status: Microphone access denied or error."
        statusElement.classList.remove("status-recording")
        statusElement.classList.add("status-idle")
        alert("Could not access microphone. Please ensure it is connected and permissions are granted.")
      }
    } else {
      // Stop recording
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop()
        toggleButton.textContent = "Start Voice Chat"
        statusElement.textContent = "Status: Connected, Idle"
        statusElement.classList.remove("status-recording")
        statusElement.classList.add("status-idle")
        console.log("Recording stopped.")
      }
    }
  })
})
