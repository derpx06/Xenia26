# 🎨 Frontend Project Architecture

## Overview

A modern React application built with Vite, featuring an **Outreach AI** platform with authentication, dashboard, and a chat interface. The project uses TailwindCSS for styling and includes stunning 3D WebGL background animations.

---

## 📁 Project Structure

```
Frontend/
├── public/                      # Static assets
├── src/
│   ├── assets/                  # Images, icons, etc.
│   ├── components/
│   │   └── Sidebar.jsx         # Shared navigation sidebar
│   ├── pages/
│   │   ├── Landing.jsx         # Landing page
│   │   ├── LoginPage.jsx       # User login
│   │   ├── RegisterPage.jsx    # User registration
│   │   ├── Dashboard.jsx       # Main dashboard
│   │   └── OutreachChat.jsx    # AI chat interface ⭐
│   ├── utils/
│   │   └── Prism.jsx          # 3D WebGL background animation
│   ├── App.jsx                 # Main app with routing
│   ├── main.jsx                # React entry point
│   └── index.css               # Global styles
├── package.json
├── vite.config.js
└── tailwind.config.js
```

---

## 🧩 Core Components

### 1. **App.jsx** - Main Application Router

**File**: [`/home/manas/Documents/Xenia26/Frontend/src/App.jsx`](file:///home/manas/Documents/Xenia26/Frontend/src/App.jsx)

**Purpose**: Application root with React Router setup

**Routes**:
- `/` → Landing page
- `/login` → Login page
- `/register` → Registration
- `/dashboard` → Dashboard (protected)
- `/outreach` → Chat interface (protected)

**Features**:
- Global 3D Prism background animation
- Dark theme by default
- React Router DOM navigation

---

### 2. **OutreachChat.jsx** - AI Chat Interface ⭐

**File**: [`/home/manas/Documents/Xenia26/Frontend/src/pages/OutreachChat.jsx`](file:///home/manas/Documents/Xenia26/Frontend/src/pages/OutreachChat.jsx)

**Purpose**: Chat interface for AI-powered outreach message generation

#### Current Implementation

**State Management**:
```javascript
const [messages, setMessages] = useState([...]);  // Chat messages
const [input, setInput] = useState("");            // User input
const [thinking, setThinking] = useState(false);   // Loading state
```

**Message Types**:
1. **Draft Messages** (`type: "draft"`)
   - Contains: `subject` and `body`
   - Displayed as formatted email drafts
   - Visual: Dark card with subject/message sections

2. **Text Messages** (`type: "text"`)
   - User messages: Blue bubble on right
   - Assistant messages: Gray bubble on left

**Key Features**:
- ✅ Message history display
- ✅ Email draft rendering
- ✅ Loading/"thinking" indicator
- ✅ Keyboard support (Enter to send)
- ✅ Auto-scroll to bottom
- ✅ Quick action buttons ("Shorten", "Casual Tone", etc.)

#### Current Limitations ⚠️

**🚨 NO REAL API INTEGRATION**:
```javascript
// Currently using setTimeout mock (line 38-49)
setTimeout(() => {
  setThinking(false);
  setMessages((prev) => [
    ...prev,
    {
      role: "assistant",
      type: "text",
      content: "I refined the message. Want it shorter, more formal, or add a CTA?",
    },
  ]);
}, 1200);
```

**What's Missing**:
- ❌ No actual API calls to backend
- ❌ No streaming responses
- ❌ No real LLM integration
- ❌ No conversation persistence
- ❌ Hardcoded mock responses

#### Component Structure

```jsx
<OutreachChat>
  <Sidebar />                    {/* Navigation */}
  
  <div className="flex-1">
    {/* Top Bar */}
    <TopBar />
    
    {/* Chat Messages Area */}
    <div className="chat-area">
      {messages.map(msg => 
        msg.type === "draft" 
          ? <DraftEmail {...msg} />
          : <TextMessage {...msg} />
      )}
      
      {thinking && <ThinkingIndicator />}
      <div ref={bottomRef} />
    </div>
    
    {/* Input Bar */}
    <div className="input-area">
      <input />
      <button>Send</button>
      <QuickActions />          {/* Preset prompts */}
    </div>
  </div>
</OutreachChat>
```

---

### 3. **Sidebar.jsx** - Navigation Component

**File**: [`/home/manas/Documents/Xenia26/Frontend/src/components/Sidebar.jsx`](file:///home/manas/Documents/Xenia26/Frontend/src/components/Sidebar.jsx)

**Navigation Items**:
- Dashboard (`/dashboard`)
- Outreach (`/outreach`)
- Analytics (`/analytics`) - Not yet implemented
- Settings (`/settings`) - Not yet implemented
- Logout button

**Features**:
- Active route highlighting
- Icons from Lucide React
- React Router navigation
- LocalStorage-based logout

---

### 4. **Dashboard.jsx** - Main Dashboard

**File**: [`/home/manas/Documents/Xenia26/Frontend/src/pages/Dashboard.jsx`](file:///home/manas/Documents/Xenia26/Frontend/src/pages/Dashboard.jsx)

**Features**:
- ✅ User authentication check
- ✅ Stat cards (campaigns, emails, reply rate)
- ✅ Campaign table with progress bars
- ✅ Welcome message
- ✅ "New Campaign" button (not functional)

**Data Source**: All data is currently **hardcoded/mock**

---

### 5. **LoginPage.jsx & RegisterPage.jsx**

**Authentication Flow**:
```javascript
// Current Backend URL (hardcoded)
const response = await fetch("http://localhost:8080/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password })
});
```

**Backend Expected**: `http://localhost:8080` (NOT YOUR FASTAPI SERVER!)

**Storage**: User data stored in `localStorage.getItem("user")`

---

### 6. **Prism.jsx** - 3D Background Animation

**File**: [`/home/manas/Documents/Xenia26/Frontend/src/utils/Prism.jsx`](file:///home/manas/Documents/Xenia26/Frontend/src/utils/Prism.jsx)

**Technology**: OGL (OpenGL for the web)

**Features**:
- Custom WebGL shader for 3D pyramid/prism effect
- Configurable animations: `rotate`, `hover`, `3drotate`
- Customizable colors, glow, bloom effects
- Performance optimized with RAF and intersection observer

**Usage in App**:
```jsx
<Prism 
  animationType="3drotate"
  timeScale={0.1}
  glow={1.2}
  bloom={1.5}
  scale={5}
/>
```

---

## 🎨 Styling & Design System

### TailwindCSS Configuration

**Theme**: Dark mode focused
- Background: `bg-[#050505]`, `bg-[#0A0A0A]`, `bg-[#111]`
- Text: White with neutral grays
- Accent: Blue (`blue-600`)
- Borders: Subtle white opacity (`border-white/5`)

### Design Patterns

1. **Cards**: Rounded 2xl, dark background, subtle borders
2. **Buttons**: Blue primary, hover states
3. **Inputs**: Dark background, transparent, rounded
4. **Typography**: Mix of neutral grays for hierarchy

---

## 🔌 Technology Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **React** | UI library | 19.2.0 |
| **Vite** | Build tool | 7.2.4 |
| **React Router** | Routing | 7.13.0 |
| **TailwindCSS** | Styling | 3.4.19 |
| **Lucide React** | Icons | 0.563.0 |
| **OGL** | 3D WebGL | 1.0.11 |

**No State Management**: Pure React hooks (useState, useEffect)
**No API Client**: Just native `fetch`

---

## 🔗 API Integration Status

### Current Backend Integration

**Login/Register**: 
- ✅ Connected to `http://localhost:8080/api/auth/*`
- ⚠️ **Different from your FastAPI backend** (`localhost:8000`)

**Chat**:
- ❌ **NOT connected** to any backend
- ❌ Uses `setTimeout` for mock responses
- ❌ No actual LLM integration

### Your FastAPI Backend

Your agent API is at:
- `http://localhost:8000/ml/agent/chat` (streaming)
- `http://localhost:8000/ml/agent/chat-sync` (synchronous)

**To integrate**, you need to:
1. Replace the setTimeout mock in OutreachChat.jsx
2. Add fetch/API call to your FastAPI backend
3. Handle streaming responses (SSE)
4. Update state with real responses

---

## 🚀 Running the Frontend

```bash
cd /home/manas/Documents/Xenia26/Frontend

# Install dependencies (if needed)
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

**Default Port**: Usually `http://localhost:5173` (Vite default)

---

## 📝 OutreachChat.jsx - Detailed Analysis

### Data Flow

```
User types message
    ↓
setInput(message)
    ↓
Press Enter / Click Send
    ↓
sendMessage()
    ↓
Add user message to state
    ↓
setThinking(true)
    ↓
setTimeout (1200ms) ← MOCK DELAY
    ↓
setThinking(false)
    ↓
Add hardcoded assistant message
    ↓
Auto-scroll to bottom
```

### Message State Structure

```javascript
{
  role: "user" | "assistant",
  type: "text" | "draft",
  content: string | { subject: string, body: string }
}
```

### UI Components Breakdown

1. **Top Bar** (line 58-66)
   - Breadcrumb navigation
   - Page title
   - Model badge (LOCAL LLM v2.4)

2. **Chat Area** (line 69-117)
   - Maps through messages array
   - Renders draft emails or text bubbles
   - Shows "thinking" indicator
   - Auto-scroll ref at bottom

3. **Input Area** (line 120-142)
   - Text input field
   - Send button with icon
   - Quick action buttons

---

## 🎯 Next Steps for Integration

To connect OutreachChat to your LangGraph agent backend:

### Option 1: Synchronous (Easier)

Replace the `sendMessage` function:

```javascript
const sendMessage = async () => {
  if (!input.trim()) return;

  setMessages((prev) => [...prev, { role: "user", type: "text", content: input }]);
  const userMessage = input;
  setInput("");
  setThinking(true);

  try {
    const response = await fetch("http://localhost:8000/ml/agent/chat-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMessage,
        model: "mistral:7b",
        conversation_history: messages.filter(m => m.type === "text").map(m => ({
          role: m.role,
          content: m.content
        }))
      })
    });

    const data = await response.json();
    
    setMessages((prev) => [
      ...prev,
      { role: "assistant", type: "text", content: data.response }
    ]);
  } catch (error) {
    console.error("Error:", error);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", type: "text", content: "Sorry, I encountered an error." }
    ]);
  } finally {
    setThinking(false);
  }
};
```

### Option 2: Streaming (Better UX)

Use Server-Sent Events for real-time streaming:

```javascript
const sendMessage = async () => {
  if (!input.trim()) return;

  setMessages((prev) => [...prev, { role: "user", type: "text", content: input }]);
  const userMessage = input;
  setInput("");
  setThinking(true);

  try {
    const response = await fetch("http://localhost:8000/ml/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMessage,
        model: "mistral:7b"
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          
          if (data.type === "thought" || data.type === "response") {
            assistantMessage += data.content;
            setMessages((prev) => {
              const newMessages = [...prev];
              const lastMsg = newMessages[newMessages.length - 1];
              
              if (lastMsg && lastMsg.role === "assistant") {
                lastMsg.content = assistantMessage;
              } else {
                newMessages.push({
                  role: "assistant",
                  type: "text",
                  content: assistantMessage
                });
              }
              return newMessages;
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    setThinking(false);
  }
};
```

---

## 📊 Summary

| Component | Status | Notes |
|-----------|--------|-------|
| **OutreachChat** | ⚠️ Mock | No real API, setTimeout responses |
| **Dashboard** | ⚠️ Mock | Hardcoded stats and campaigns |
| **Login/Register** | ✅ Partial | Points to different backend (port 8080) |
| **Sidebar** | ✅ Working | Navigation functional |
| **Prism** | ✅ Working | 3D animations functional |
| **Routing** | ✅ Working | React Router setup complete |

**Key Insight**: The chat UI is fully built and styled, but completely disconnected from your LangGraph agent backend. Integration requires updating the `sendMessage` function in [OutreachChat.jsx](file:///home/manas/Documents/Xenia26/Frontend/src/pages/OutreachChat.jsx).

---

## 🔗 Related Documentation

- [FastAPI Agent API - Postman Guide](file:///home/manas/Documents/Xenia26/fastapi/POSTMAN_GUIDE.md)
- [Agent Quick Start](file:///home/manas/Documents/Xenia26/fastapi/QUICKSTART.md)
- [Agent README](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/README.md)
