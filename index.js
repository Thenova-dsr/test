import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import path from "path"
import { fileURLToPath } from "url" // Add this import

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url) // Corrected
const __dirname = path.dirname(__filename)

const app = express()
const server = createServer(app)
const io = new Server(server)

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")))

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id)

  // Listen for audio chunks from this client
  socket.on("audioChunk", (chunk) => {
    // Broadcast the audio chunk to all other connected clients
    socket.broadcast.emit("audioChunk", chunk)
  })

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id)
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
