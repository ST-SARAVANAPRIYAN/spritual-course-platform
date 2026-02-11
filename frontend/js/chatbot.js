/**
 * InnerSpark - Spiritual Guide Chatbot
 */

(function () {
    // 1. Create UI
    const botHtml = `
        <div id="chatbot-bubble" style="position: fixed; bottom: 30px; right: 30px; width: 60px; height: 60px; background: var(--color-saffron); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; box-shadow: 0 10px 30px rgba(0,0,0,0.2); z-index: 9999; transition: 0.3s;">
            <i class="fas fa-comment-dots" style="font-size: 1.5rem;"></i>
        </div>
        <div id="chatbot-window" style="display: none; position: fixed; bottom: 100px; right: 30px; width: 350px; height: 500px; background: white; border-radius: 20px; flex-direction: column; overflow: hidden; box-shadow: 0 15px 50px rgba(0,0,0,0.15); z-index: 9999; border: 1px solid rgba(255,153,51,0.1);">
            <div style="background: var(--color-saffron); padding: 20px; color: white; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0;">Spiritual Guide</h4>
                    <p style="margin: 0; font-size: 0.7rem; opacity: 0.8;">Bridges technology & wisdom</p>
                </div>
                <i class="fas fa-times" id="close-chatbot" style="cursor: pointer;"></i>
            </div>
            <div id="chat-messages" style="flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; background: #fdfaf7;">
                <div style="background: white; padding: 12px; border-radius: 12px 12px 12px 0; max-width: 80%; font-size: 0.9rem; align-self: flex-start; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">Greetings, seeker. How can I assist with your course?</div>
            </div>
            <div style="padding: 15px; border-top: 1px solid #eee; display: flex; gap: 10px;">
                <input type="text" id="chat-input" placeholder="Ask anything..." style="flex: 1; border: none; outline: none; font-size: 0.9rem; padding: 10px;">
                <button id="send-chat" style="background: none; border: none; color: var(--color-saffron); cursor: pointer; font-size: 1.2rem;"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = botHtml;
    document.body.appendChild(div);

    // 2. Logic
    const bubble = document.getElementById('chatbot-bubble');
    const windowEl = document.getElementById('chatbot-window');
    const closeBtn = document.getElementById('close-chatbot');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-chat');
    const messages = document.getElementById('chat-messages');

    bubble.addEventListener('click', () => {
        windowEl.style.display = windowEl.style.display === 'none' ? 'flex' : 'none';
    });

    closeBtn.addEventListener('click', () => { windowEl.style.display = 'none'; });

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

    let awaitingEmail = false;

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        input.value = '';

        try {
            const body = awaitingEmail ? { message: "Sharing email", email: text } : { message: text };

            const API_BASE = (typeof Auth !== 'undefined' ? Auth.apiBase : 'http://localhost:5000/api');
            const res = await fetch(`${API_BASE}/chatbot/ask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (data.requireEmail) {
                awaitingEmail = true;
                input.placeholder = "Enter your email...";
            } else if (awaitingEmail) {
                awaitingEmail = false;
                input.placeholder = "Ask anything...";
            }

            addMessage(data.response, 'bot');
        } catch (err) {
            addMessage("I am temporarily disconnected from the sanctuary.", 'bot');
        }
    }

    function addMessage(text, type) {
        const msgDiv = document.createElement('div');
        msgDiv.style.padding = '12px';
        msgDiv.style.borderRadius = type === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0';
        msgDiv.style.maxWidth = '80%';
        msgDiv.style.fontSize = '0.9rem';
        msgDiv.style.alignSelf = type === 'user' ? 'flex-end' : 'flex-start';
        msgDiv.style.background = type === 'user' ? 'var(--color-saffron)' : 'white';
        msgDiv.style.color = type === 'user' ? 'white' : 'inherit';
        msgDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.02)';
        msgDiv.textContent = text;
        messages.appendChild(msgDiv);
        messages.scrollTop = messages.scrollHeight;
    }
})();
