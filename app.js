const firebaseConfig = {
    apiKey: "AIzaSyD7CF-vhlip_kEWX8yLwedxnPmvvhPFEWA",
    authDomain: "group-chat-app-28514.firebaseapp.com",
    databaseURL: "https://group-chat-app-28514-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "group-chat-app-28514",
    storageBucket: "group-chat-app-28514.appspot.com",
    messagingSenderId: "952526179804",
    appId: "1:952526179804:web:8a2e74927e8084f9d35319"
  };
  
  // Initialize Firebase
  const app = firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const database = firebase.database();
  
  // DOM Elements
  const authContainer = document.getElementById('auth-container');
  const chatContainer = document.getElementById('chat-container');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userDisplayName = document.getElementById('user-display-name');
  const fileInput = document.getElementById('file-input');
  const previewContainer = document.getElementById('preview-container');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const messagesDiv = document.getElementById('messages');
  const recordBtn = document.getElementById('record-btn');
  
  // Voice recording variables
  let mediaRecorder;
  let audioChunks = [];
  let isRecording = false;
  
    // Store usernames (you would maintain this mapping)
    const usernameMap = {
        "nedalomarsahar@gmail.com": "sahar",
        "omarkharbutli9@gmail.com": "omar",
        "nedalkharboutli@gmail.com": "nedal",
        // Add all your users here
    };
  
  // Store attachments to be sent
  let attachments = [];
  
  // Auth State Listener
  auth.onAuthStateChanged(user => {
      if (user) {
          const displayName = usernameMap[user.email] || user.email.split('@')[0];
          showChatInterface(displayName);
          setupChat(user.email);
      } else {
          showLoginInterface();
      }
  });
  
  function showChatInterface(displayName) {
      authContainer.classList.add('hidden');
      chatContainer.classList.remove('hidden');
      userDisplayName.textContent = displayName;
  }
  
  function showLoginInterface() {
      authContainer.classList.remove('hidden');
      chatContainer.classList.add('hidden');
      emailInput.value = '';
      passwordInput.value = '';
  }
  
  // Login Handler
  loginBtn.addEventListener('click', async () => {
      const email = emailInput.value;
      const password = passwordInput.value;
  
      try {
          await auth.signInWithEmailAndPassword(email, password);
      } catch (error) {
          alert(`Login failed: ${error.message}`);
      }
  });
  
  // Logout Handler
  logoutBtn.addEventListener('click', () => {
      auth.signOut();
      attachments = [];
      previewContainer.innerHTML = '';
      previewContainer.classList.add('hidden');
  });
  
  // Voice Recording Handler
  recordBtn.addEventListener('click', toggleRecording);
  
  async function toggleRecording() {
      if (!isRecording) {
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              mediaRecorder = new MediaRecorder(stream);
              audioChunks = [];
              
              mediaRecorder.ondataavailable = (e) => {
                  if (e.data.size > 0) audioChunks.push(e.data);
              };
              
              mediaRecorder.onstop = async () => {
                  const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                  
                  // Convert to Base64
                  const reader = new FileReader();
                  reader.onload = () => {
                      const base64Audio = reader.result.split(',')[1];
                      attachments = [{
                          name: 'voice-message.wav',
                          type: 'audio/wav',
                          size: audioBlob.size,
                          data: base64Audio
                      }];
                      previewContainer.innerHTML = `
                          <div class="attachment-preview">
                              <div class="attachment-info">
                                  Voice message (${(audioBlob.size/1024).toFixed(2)} KB)
                                  <span class="remove-attachment">✕</span>
                              </div>
                          </div>
                      `;
                      previewContainer.classList.remove('hidden');
                      
                      // Add remove handler
                      document.querySelector('.remove-attachment').onclick = () => {
                          previewContainer.innerHTML = '';
                          previewContainer.classList.add('hidden');
                          attachments = [];
                      };
                  };
                  reader.readAsDataURL(audioBlob);
              };
              
              mediaRecorder.start();
              isRecording = true;
              recordBtn.classList.add('recording');
          } catch (error) {
              alert('Error accessing microphone: ' + error.message);
          }
      } else {
          mediaRecorder.stop();
          isRecording = false;
          recordBtn.classList.remove('recording');
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
  }
  
  // File Attachment Handler
  fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Enforce 1MB size limit
      if (file.size > 1 * 1024 * 1024) {
          alert('File too large (max 1MB)');
          return;
      }
  
      const reader = new FileReader();
      reader.onload = (event) => {
          previewContainer.innerHTML = '';
          previewContainer.classList.remove('hidden');
          
          const preview = document.createElement('div');
          preview.className = 'attachment-preview';
          
          if (file.type.startsWith('image/')) {
              const img = document.createElement('img');
              img.src = event.target.result;
              preview.appendChild(img);
          }
          
          const info = document.createElement('div');
          info.className = 'attachment-info';
          info.innerHTML = `
              <div class="attachment-name">${file.name}</div>
              <div>${(file.size / 1024).toFixed(2)} KB</div>
              <span class="remove-attachment">✕</span>
          `;
          
          preview.appendChild(info);
          previewContainer.appendChild(preview);
          
          // Store the Base64 data
          attachments = [{
              name: file.name,
              type: file.type,
              size: file.size,
              data: event.target.result.split(',')[1]
          }];
          
          // Remove attachment handler
          info.querySelector('.remove-attachment').onclick = () => {
              previewContainer.innerHTML = '';
              previewContainer.classList.add('hidden');
              attachments = [];
          };
      };
      reader.readAsDataURL(file);
  });
  
  // Chat Functionality
  function setupChat(currentUserEmail) {
      const messagesRef = database.ref('messages');
      const messageElements = {};
  
      const formatTime = (timestamp) => {
          if (!timestamp) return '';
          const date = new Date(timestamp);
          return date.toLocaleString();
      };
  
      messagesRef.on('child_added', snapshot => {
          const { text, email: senderEmail, timestamp, attachment } = snapshot.val();
          const isCurrentUser = senderEmail === currentUserEmail;
          const displayName = usernameMap[senderEmail] || senderEmail.split('@')[0];
          
          const messageEl = document.createElement('div');
          messageEl.className = `message ${isCurrentUser ? 'my-message' : 'their-message'}`;
          messageEl.setAttribute('data-id', snapshot.key);
          
          let content = `<div class="message-info">${displayName} • ${formatTime(timestamp)}</div>`;
          
          if (attachment) {
              if (attachment.type.startsWith('image/')) {
                  content += `
                      <div class="attachment-message">
                          <img src="data:${attachment.type};base64,${attachment.data}" 
                               alt="${attachment.name}" 
                               style="max-width: 200px; max-height: 200px;">
                          ${text ? `<div class="text">${text}</div>` : ''}
                      </div>
                  `;
              } else if (attachment.type.startsWith('audio/')) {
                  content += `
                      <div class="attachment-message">
                          <div class="audio-message">
                              <audio controls src="data:${attachment.type};base64,${attachment.data}"></audio>
                          </div>
                          ${text ? `<div class="text">${text}</div>` : ''}
                      </div>
                  `;
              } else {
                  content += `
                      <div class="attachment-message">
                          <div class="attachment-info">
                              ${attachment.name} (${(attachment.size / 1024).toFixed(2)} KB)
                          </div>
                          ${text ? `<div class="text">${text}</div>` : ''}
                      </div>
                  `;
              }
          } else if (text) {
              content += `<div class="text">${text}</div>`;
          }
          
          if (isCurrentUser) {
              content += `
                  <div class="message-actions">
                      <button class="unsend-btn" data-id="${snapshot.key}">×</button>
                  </div>
              `;
          }
          
          messageEl.innerHTML = content;
          messagesDiv.appendChild(messageEl);
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
          messageElements[snapshot.key] = messageEl;
      });
  
      messagesRef.on('child_removed', snapshot => {
          const messageId = snapshot.key;
          const messageEl = messageElements[messageId];
          if (messageEl) {
              messageEl.remove();
              delete messageElements[messageId];
          }
      });
  
      messagesDiv.addEventListener('click', (e) => {
          if (e.target.classList.contains('unsend-btn')) {
              const messageId = e.target.getAttribute('data-id');
              if (confirm('Are you sure you want to unsend this message?')) {
                  messagesRef.child(messageId).remove()
                      .catch(error => alert('Failed to unsend message'));
              }
          }
      });
  
      sendBtn.addEventListener('click', async () => {
          const text = messageInput.value.trim();
          if (!text && attachments.length === 0) return;
  
          try {
              await messagesRef.push({
                  text,
                  email: currentUserEmail,
                  timestamp: firebase.database.ServerValue.TIMESTAMP,
                  ...(attachments.length > 0 && { 
                      attachment: attachments[0] 
                  })
              });
  
              // Reset inputs
              messageInput.value = '';
              previewContainer.innerHTML = '';
              previewContainer.classList.add('hidden');
              attachments = [];
          } catch (error) {
              alert('Failed to send message');
              console.error(error);
          }
      });
  
      messageInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendBtn.click();
          }
      });
  }