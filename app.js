// Your Firebase config (replace with your own)
const firebaseConfig = {
    apiKey: "AIzaSyD7CF-vhlip_kEWX8yLwedxnPmvvhPFEWA",
    authDomain: "group-chat-app-28514.firebaseapp.com",
    databaseURL: "https://group-chat-app-28514-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "group-chat-app-28514",
    storageBucket: "group-chat-app-28514.firebasestorage.app",
    messagingSenderId: "952526179804",
    appId: "1:952526179804:web:8a2e74927e8084f9d35319",
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
  const userEmailSpan = document.getElementById('user-email');
  
  // Auth State Listener
  auth.onAuthStateChanged(user => {
      if (user) {
          showChatInterface(user.email);
          setupChat();
      } else {
          showLoginInterface();
      }
  });
  
  function showChatInterface(email) {
      authContainer.classList.add('hidden');
      chatContainer.classList.remove('hidden');
      userEmailSpan.textContent = email;
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
  logoutBtn.addEventListener('click', () => auth.signOut());
  
  // Chat Functionality
  function setupChat() {
      const messagesRef = database.ref('messages');
      const messageInput = document.getElementById('message-input');
      const sendBtn = document.getElementById('send-btn');
      const messagesDiv = document.getElementById('messages');
  
      // Format timestamp
      const formatTime = (timestamp) => {
          if (!timestamp) return '';
          const date = new Date(timestamp);
          return date.toLocaleString();
      };
  
      messagesRef.on('child_added', snapshot => {
          const { text, email: senderEmail, timestamp } = snapshot.val();
          const isCurrentUser = senderEmail === auth.currentUser.email;
          
          const messageEl = document.createElement('div');
          messageEl.className = `message ${isCurrentUser ? 'my-message' : 'their-message'}`;
          messageEl.innerHTML = `
              <div class="message-info">${senderEmail} • ${formatTime(timestamp)}</div>
              <div class="text">${text}</div>
              ${isCurrentUser ? `<div class="message-actions">
                  <button class="unsend-btn" data-id="${snapshot.key}">×</button>
              </div>` : ''}
          `;
          
          messagesDiv.appendChild(messageEl);
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
      });
  
      // Handle unsend button clicks
      messagesDiv.addEventListener('click', (e) => {
          if (e.target.classList.contains('unsend-btn')) {
              const messageId = e.target.getAttribute('data-id');
              if (confirm('Are you sure you want to unsend this message?')) {
                  messagesRef.child(messageId).remove()
                      .catch(error => alert('Failed to unsend message'));
              }
          }
      });
  
      // Send message handler
      sendBtn.addEventListener('click', async () => {
          const message = messageInput.value.trim();
          if (!message) return;
  
          try {
              await messagesRef.push({
                  text: message,
                  email: auth.currentUser.email,
                  timestamp: firebase.database.ServerValue.TIMESTAMP
              });
              messageInput.value = '';
          } catch (error) {
              alert('Failed to send message');
          }
      });
  
      // Allow sending message with Enter key (Shift+Enter for new line)
      messageInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendBtn.click();
          }
      });
  }