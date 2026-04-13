import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // API for local network info
  app.get("/api/info", async (req, res) => {
    const os = await import("os");
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const k in interfaces) {
      for (const k2 in interfaces[k]) {
        const address = interfaces[k][k2];
        if (address.family === "IPv4" && !address.internal) {
          addresses.push(address.address);
        }
      }
    }
    res.json({ 
      localIps: addresses,
      port: PORT,
      note: "Usa estas IPs para conectarte desde otros dispositivos en la misma red Wi-Fi."
    });
  });

  // In-memory store for room passwords and occupant counts
  const roomPasswords = new Map<string, string>();
  const roomOccupants = new Map<string, Set<string>>();

  // Socket.io signaling logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", ({ roomId, password }) => {
      // If room doesn't exist or is empty, set/reset the password
      if (!roomPasswords.has(roomId) || !roomOccupants.has(roomId) || roomOccupants.get(roomId)!.size === 0) {
        roomPasswords.set(roomId, password);
        roomOccupants.set(roomId, new Set());
      }

      // Validate password
      if (roomPasswords.get(roomId) !== password) {
        socket.emit("error", "Contraseña de sala incorrecta. Prueba con otro ID de sala si crees que este ya está en uso.");
        return;
      }

      // Check if room is full (max 2 users: 1 camera, 1 viewer)
      const occupants = roomOccupants.get(roomId);
      if (occupants && occupants.size >= 2) {
        socket.emit("error", "La sala está llena. Por seguridad, solo se permiten 2 dispositivos por sala.");
        return;
      }

      socket.join(roomId);
      roomOccupants.get(roomId)!.add(socket.id);
      
      console.log(`User ${socket.id} joined room ${roomId}. Occupants: ${roomOccupants.get(roomId)!.size}`);
      socket.emit("joined", roomId);
      
      socket.to(roomId).emit("user-joined", socket.id);

      // Handle disconnection
      socket.on("disconnect", () => {
        const occupants = roomOccupants.get(roomId);
        if (occupants) {
          occupants.delete(socket.id);
          console.log(`User ${socket.id} left room ${roomId}. Occupants: ${occupants.size}`);
          
          if (occupants.size === 0) {
            roomPasswords.delete(roomId);
            roomOccupants.delete(roomId);
            console.log(`Room ${roomId} cleared.`);
          }
        }
      });
    });

    socket.on("offer", ({ roomId, offer }) => {
      socket.to(roomId).emit("offer", { offer, from: socket.id });
    });

    socket.on("answer", ({ roomId, answer }) => {
      socket.to(roomId).emit("answer", { answer, from: socket.id });
    });

    socket.on("ice-candidate", ({ roomId, candidate }) => {
      socket.to(roomId).emit("ice-candidate", { candidate, from: socket.id });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
