const socket = io()
let currentRoom = null
let mySocketId = null
let unreadCount = 0 // Contador de mensajes no leídos
const notificationSound = new Audio('/media/chat_alert.wav') // Archivo de sonido en public

// Al conectarse, guardar el id del socket del usuario
socket.on('connect', () => {
  mySocketId = socket.id
})

// Desbloquear el audio en el primer clic sin emitir sonido audible
document.addEventListener(
  'DOMContentLoaded',
  () => {
    notificationSound
      .play()
      .then(() => {
        notificationSound.pause()
        notificationSound.currentTime = 0
      })
      .catch(error => {
        console.error('Error al desbloquear el audio:', error)
      })
  },
  { once: true }
)

socket.on('waiting', data => {
  document.getElementById('status').innerText = data.message
})

socket.on('partnerFound', data => {
  currentRoom = data.room
  // Mensaje de estado al emparejarse
  document.getElementById(
    'status'
  ).innerText = `You're now chatting with a random stranger. Say Hi!`
  document.getElementById('terminateChatButton').style.display = 'inline'
  document.getElementById('newPartnerButton').style.display = 'none'
  document.getElementById('sendMessageButton').disabled = false
  // Reiniciar contador y title
  unreadCount = 0
  document.title = 'Chat Aleatorio'

  const soundClone = notificationSound.cloneNode()
  soundClone
    .play()
    .catch(err => console.error('Error al reproducir el sonido:', err))
})

socket.on('message', data => {
  const messagesDiv = document.getElementById('messages')
  const newMessage = document.createElement('div')

  let prefixHtml =
    data.sender === mySocketId
      ? `<span style="color: #f78301;">Tu:</span>`
      : `<span style="color: #3f9fff;">Extraño:</span>`

  newMessage.innerHTML = `${prefixHtml} ${data.text}`
  messagesDiv.appendChild(newMessage)
  messagesDiv.scrollTop = messagesDiv.scrollHeight

  // Si el mensaje proviene del extraño, actualizar el title y reproducir sonido
  if (data.sender !== mySocketId) {
    unreadCount++
    document.title = `Mensaje (${unreadCount})`
    // Crear un clon del objeto de audio para reproducirlo de forma independiente
    const soundClone = notificationSound.cloneNode()
    soundClone
      .play()
      .catch(err => console.error('Error al reproducir el sonido:', err))
  }
})

socket.on('chatTerminated', () => {
  document.getElementById('terminateChatButton').style.display = 'none'
  document.getElementById('newPartnerButton').style.display = 'inline'
  document.getElementById('sendMessageButton').disabled = true
})

socket.on('partnerLeft', data => {
  document.getElementById('status').innerText = data.message
})

document.getElementById('messageForm').addEventListener('submit', e => {
  e.preventDefault()
  const messageInput = document.getElementById('messageInput')
  const text = messageInput.value
  if (text && currentRoom) {
    socket.emit('message', { room: currentRoom, text })
    messageInput.value = ''
  }
})

document.getElementById('terminateChatButton').addEventListener('click', () => {
  if (confirm('¿De verdad quiere terminar el chat?')) {
    socket.emit('terminateChat', { room: currentRoom })
    document.getElementById('terminateChatButton').style.display = 'none'
    document.getElementById('newPartnerButton').style.display = 'inline'
    document.getElementById('sendMessageButton').disabled = true
  }
})

document.getElementById('newPartnerButton').addEventListener('click', () => {
  document.getElementById('messages').innerHTML = ''
  document.getElementById('status').innerText = 'Buscando a un nuevo extraño...'
  document.getElementById('newPartnerButton').style.display = 'none'
  document.getElementById('terminateChatButton').style.display = 'inline'
  document.getElementById('sendMessageButton').disabled = false
  socket.emit('searchNewPartner')
})


