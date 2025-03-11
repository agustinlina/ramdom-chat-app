// server.js
import express from 'express'
import http from 'http'
import { Server as socketIo } from 'socket.io'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

const adapter = new JSONFile('db.json')
const db = new Low(adapter, { chatLogs: {} })

// Lectura y asignación de datos por defecto en lowdb
try {
  await db.read()
} catch (error) {
  console.error('Error al leer db.json, asignando datos por defecto.', error)
  db.data = { chatLogs: {} }
  await db.write()
}
db.data ||= { chatLogs: {} }
await db.write()

const app = express()
const server = http.createServer(app)
const io = new socketIo(server)

app.use(express.static('public'))

let waitingUser = null // Usuario en espera para emparejamiento

io.on('connection', socket => {
  console.log('Usuario conectado:', socket.id)

  // Emparejamiento de usuarios
  if (waitingUser && waitingUser.id !== socket.id) {
    const room = `room-${waitingUser.id}-${socket.id}`
    waitingUser.join(room)
    socket.join(room)

    waitingUser.emit('partnerFound', { room, partnerId: socket.id })
    socket.emit('partnerFound', { room, partnerId: waitingUser.id })

    waitingUser = null
  } else {
    waitingUser = socket
    socket.emit('waiting', { message: 'Esperando a un extraño...' })
  }

  // Manejo de mensajes
  socket.on('message', async data => {
    io.to(data.room).emit('message', {
      sender: socket.id,
      text: data.text
    })

    const log = { sender: socket.id, text: data.text, timestamp: Date.now() }

    // Asegurarse de que existan los datos en lowdb
    if (!db.data) db.data = { chatLogs: {} }
    if (!db.data.chatLogs) db.data.chatLogs = {}
    if (!db.data.chatLogs[data.room]) {
      db.data.chatLogs[data.room] = []
    }

    db.data.chatLogs[data.room].push(log)
    await db.write()
  })

  // Evento para terminar el chat
  socket.on('terminateChat', data => {
    io.to(data.room).emit('message', {
      sender: socket.id,
      text: 'chat finalizado'
    })
    io.to(data.room).emit('chatTerminated')
  })

  // Evento para buscar una nueva pareja
  socket.on('searchNewPartner', () => {
    // Elimina al socket de todas las salas actuales (excepto su sala propia)
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.leave(room)
      }
    }
    if (waitingUser === socket) {
      waitingUser = null
    }
    if (waitingUser) {
      const room = `room-${waitingUser.id}-${socket.id}`
      waitingUser.join(room)
      socket.join(room)
      waitingUser.emit('partnerFound', { room, partnerId: socket.id })
      socket.emit('partnerFound', { room, partnerId: waitingUser.id })
      waitingUser = null
    } else {
      waitingUser = socket
      socket.emit('waiting', { message: 'Esperando a un extraño...' })
    }
  })

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id)
    if (waitingUser && waitingUser.id === socket.id) {
      waitingUser = null
    }
    socket.broadcast.emit('partnerLeft', {
      message: 'El extraño se ha desconectado.'
    })
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto http://127.0.0.1:${PORT}`)
})
