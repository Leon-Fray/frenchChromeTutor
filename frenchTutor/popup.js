// popup.js - Handles the extension popup functionality
document.addEventListener('DOMContentLoaded', function() {
    const readArticleBtn = document.getElementById('readArticle');
    const startConversationBtn = document.getElementById('startConversation');
    const sendMessageBtn = document.getElementById('sendMessage');
    const userInput = document.getElementById('userInput');
    const conversation = document.getElementById('conversation');
    const microphone = document.getElementById('microphone');
    const voiceToggle = document.getElementById('voiceToggle');
    
    let isRecording = false;
    let mediaRecorder;
    let audioChunks = [];
    let currentArticleContent = "";
    let conversationHistory = [];
    
    // OpenAI API integration
    const apiKey = CONFIG.OPENAI_API_KEY; // Get API key from config.js
    const baseUrl = 'https://api.openai.com/v1';
    
    // Read the current article
    readArticleBtn.addEventListener('click', async () => {
      // Send message to content script to extract article text
      chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {action: "extractArticle"}, (response) => {
          if (response && response.articleContent) {
            currentArticleContent = response.articleContent;
            addAssistantMessage("J'ai lu l'article. Nous pouvons maintenant en discuter en français!");
          } else {
            addAssistantMessage("Je n'ai pas pu extraire le contenu de l'article. Veuillez réessayer sur une autre page.");
          }
        });
      });
    });
    
    // Start a French conversation about the article
    startConversationBtn.addEventListener('click', async () => {
      if (!currentArticleContent) {
        addAssistantMessage("Veuillez d'abord lire un article en cliquant sur 'Read Current Article'.");
        return;
      }
      
      // Send article to OpenAI for processing
      try {
        const initialPrompt = await analyzeArticle(currentArticleContent);
        addAssistantMessage(initialPrompt);
        // Reset conversation history
        conversationHistory = [];
      } catch (error) {
        addAssistantMessage("Désolé, je n'ai pas pu démarrer la conversation. Veuillez réessayer.");
        console.error(error);
      }
    });
    
    // Send a text message
    sendMessageBtn.addEventListener('click', () => {
      sendUserMessage();
    });
    
    userInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendUserMessage();
      }
    });
    
    // Handle microphone for voice input
    microphone.addEventListener('click', () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    });
    
    // Toggle between text and voice modes
    voiceToggle.addEventListener('change', () => {
      if (voiceToggle.checked) {
        microphone.classList.remove('hidden');
      } else {
        microphone.classList.add('hidden');
        if (isRecording) {
          stopRecording();
        }
      }
    });
    
    function addUserMessage(text) {
      const messageElement = document.createElement('div');
      messageElement.className = 'user-message';
      messageElement.textContent = text;
      conversation.appendChild(messageElement);
      conversation.scrollTop = conversation.scrollHeight;
      
      // Add to conversation history
      conversationHistory.push({
        role: 'user',
        content: text
      });
    }
    
    function addAssistantMessage(text) {
      const messageElement = document.createElement('div');
      messageElement.className = 'assistant-message';
      messageElement.textContent = text;
      conversation.appendChild(messageElement);
      conversation.scrollTop = conversation.scrollHeight;
      
      // Add to conversation history if it's not the initial greeting
      if (conversation.children.length > 1) {
        conversationHistory.push({
          role: 'assistant',
          content: text
        });
      }
      
      // If voice mode is enabled, also speak the message
      if (voiceToggle.checked) {
        speakFrench(text);
      }
    }
    
    function sendUserMessage() {
      const message = userInput.value.trim();
      if (!message) return;
      
      addUserMessage(message);
      userInput.value = '';
      
      // Process the message and get a response
      processUserMessage(message);
    }
    
    async function processUserMessage(message) {
      try {
        // Send to OpenAI API and get response
        const response = await getResponse(message);
        addAssistantMessage(response);
      } catch (error) {
        addAssistantMessage("Désolé, je n'ai pas pu traiter votre message. Veuillez réessayer.");
        console.error(error);
      }
    }
    
    async function startRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.addEventListener('dataavailable', event => {
          audioChunks.push(event.data);
        });
        
        mediaRecorder.addEventListener('stop', async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          
          // Convert audio to text using OpenAI's Whisper API
          try {
            const transcription = await transcribeAudio(audioBlob);
            if (transcription) {
              addUserMessage(transcription);
              processUserMessage(transcription);
            }
          } catch (error) {
            console.error('Transcription error:', error);
            addAssistantMessage("Je n'ai pas pu transcrire l'audio. Veuillez réessayer.");
          }
        });
        
        mediaRecorder.start();
        isRecording = true;
        microphone.classList.add('recording');
      } catch (error) {
        console.error('Error accessing microphone:', error);
        addAssistantMessage("Je n'ai pas pu accéder au microphone. Veuillez vérifier les permissions.");
      }
    }
    
    function stopRecording() {
      if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        microphone.classList.remove('recording');
      }
    }
    
    function speakFrench(text) {
      // Use Chrome's TTS API
      chrome.tts.speak(text, {
        lang: 'fr-FR',
        rate: 0.9,
        pitch: 1.0,
        onEvent: function(event) {
          if (event.type === 'error') {
            console.error('TTS Error:', event);
          }
        }
      });
    }
    
    // OpenAI API functions
    async function analyzeArticle(articleContent) {
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo', // Using the free tier model
            messages: [
              {
                role: 'system',
                content: 'You are a French language tutor. Analyze this article and prepare to have a conversation about it in French. Keep your initial message brief and welcoming, suitable for a beginner to intermediate French learner.'
              },
              {
                role: 'user',
                content: `Please analyze this article and start a conversation about it in French: ${articleContent.substring(0, 1500)}...`
              }
            ],
            max_tokens: 200
          })
        });
        
        const data = await response.json();
        
        if (data.error) {
          console.error('OpenAI API error:', data.error);
          return "Je n'ai pas pu analyser l'article. Veuillez réessayer.";
        }
        
        return data.choices[0].message.content;
      } catch (error) {
        console.error('Article analysis error:', error);
        throw error;
      }
    }
    
    async function getResponse(userMessage) {
      try {
        const messages = [
          {
            role: 'system',
            content: `You are a French language tutor having a conversation with a student about an article. 
                      Respond in French at an appropriate level for a beginner to intermediate learner. 
                      Keep responses relatively short and encouraging. 
                      If the student writes in English, you can respond with French and include an English translation.
                      The article is about: ${currentArticleContent.substring(0, 200)}...`
          },
          ...conversationHistory,
          {
            role: 'user',
            content: userMessage
          }
        ];
        
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: messages,
            max_tokens: 250
          })
        });
        
        const data = await response.json();
        
        if (data.error) {
          console.error('OpenAI API error:', data.error);
          return "Désolé, je n'ai pas pu générer une réponse. Veuillez réessayer.";
        }
        
        return data.choices[0].message.content;
      } catch (error) {
        console.error('Response error:', error);
        throw error;
      }
    }
    
    async function transcribeAudio(audioBlob) {
      try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');
        formData.append('model', 'whisper-1');
        formData.append('language', 'fr');
        
        const response = await fetch(`${baseUrl}/audio/transcriptions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          body: formData
        });
        
        const data = await response.json();
        
        if (data.error) {
          console.error('OpenAI API error:', data.error);
          return null;
        }
        
        return data.text;
      } catch (error) {
        console.error('Transcription error:', error);
        throw error;
      }
    }
  });