# ⚡ TranscriberPro: Enterprise Audio Intelligence Engine

<div align="center">

[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20iOS%20%7C%20Android-0A0D14.svg?style=flat-square&logo=expo)](https://expo.dev)
[![Framework](https://img.shields.io/badge/Framework-React%20Native%200.83-61DAFB.svg?style=flat-square&logo=react)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-SDK%2055-000020.svg?style=flat-square&logo=expo)](https://expo.dev)
[![Backend](https://img.shields.io/badge/Backend-Supabase-3ECF8E.svg?style=flat-square&logo=supabase)](https://supabase.com)
[![AI](https://img.shields.io/badge/AI-Deepgram%20%7C%20Claude-8A2BE2.svg?style=flat-square)](https://anthropic.com)

</div>

---

## 🚀 Vision: The 2026 Standard for Audio Intelligence

**TranscriberPro** is an YouTube transcription and audio-intelligence platform engineered for the modern digital landscape, this project delivers fast, 95%+ accurate video-to-text conversion.

Designed for content creators, educational institutions, researchers, and compliance teams, TranscriberPro utilizes multi-stage LLM processing via Gemini to generate SEO metadata, chapter markers, and actionable insights natively within a fluid, Reanimated-driven user interface.

---

## 🛡️ The 4 Technical Moats (Enterprise Differentiators)

| Strategic Pillar | Technological Implementation | Market Value Proposition |
| :--- | :--- | :--- |
| **1. Anti-Block Architecture** | Multi-proxy extraction via Deno Edge (`process-video`) | **Unstoppable Reliability:** Bypasses YouTube datacenter IP blocking, guaranteeing stream access. |
| **2. Lightning Transcription** | Deepgram Nova-2 API + Audio Chunking | **Sub-30s Processing:** `process-audio-chunk` handles massive files rapidly with 95%+ accuracy. |
| **3. AI Insight Engine** | Anthropic Claude via Serverless Functions | **Zero-Touch SEO:** `generate-ai-insights` auto-generates chapters, summaries, and high-conversion metadata. |
| **4. "Liquid Neon" UX** | React Native + NativeWind v4 + GlassCards | **Elite 120fps Experience:** A premium dark-mode Bento Box UI with cyan glassmorphism components. |

---

## 🗺️ User Experience & Data Flow

```mermaid
sequenceDiagram
    participant U as User (App)
    participant S as Supabase DB
    participant E1 as Edge: process-video
    participant E2 as Edge: get-captions
    participant D as Deepgram Nova-2
    participant E3 as Edge: generate-ai-insights
    participant C as Anthropic Claude

    U->>S: 1. Submit YouTube URL
    S->>E1: 2. Trigger Webhook
    E1->>E1: 3. Resolve & Extract Audio
    E1->>E2: 4. Pass Audio Chunks
    E2->>D: 5. Send Audio for STT
    D-->>E2: 6. Return JSON Transcript
    E2->>S: 7. Save Raw Transcript
    S->>E3: 8. Trigger Insight Engine
    E3->>C: 9. Send Transcript Context to Gemini
    C-->>E3: 10. Return SEO/Chapters
    E3->>S: 11. Update DB & Notify Client
    S-->>U: 12. UI Updates via Realtime WebSocket
```

---

## 📁 Exact Project Architecture

The project strictly adheres to Domain-Driven Design (DDD) tailored for Expo Router:

```text
/transcriber-pro
├── app/                      # Expo Router App Directory
│   ├── (auth)/               # Authentication flows (sign-in, sign-up)
│   ├── (dashboard)/          # Protected Routes (history, settings, video views)
│   └── _layout.tsx           # Root layout & Provider injection
├── components/               # Reusable UI Architecture
│   ├── animations/           # Reanimated wrappers (e.g., FadeIn.tsx)
│   ├── domain/               # Business-specific (TranscriptViewer.tsx)
│   ├── layout/               # Structural (AdaptiveLayout.tsx, PageContainer.tsx)
│   └── ui/                   # Core design system (GlassCard.tsx, Input.tsx)
├── hooks/                    # Data Flow & API Hooks
│   ├── mutations/            # Data modification (useDeleteVideo.ts)
│   └── queries/              # Data fetching (useRealtimeVideoStatus.ts)
├── lib/                      # Core Infrastructure Interfaces
│   ├── api/                  # Edge function callers (functions.ts, queue.ts)
│   └── supabase/             # Client configuration & Secure Storage
├── services/                 # Pure Business Logic
│   ├── exportBuilder.ts      # Generates SRT, VTT, DOCX, JSON
│   ├── transcription.ts      # Deepgram payload formatting
│   └── youtube.ts            # URL validation & metadata extraction
├── store/                    # Zustand Global State Management
│   ├── useAuthStore.ts       # Client-side session state
│   └── useVideoStore.ts      # Active video context
├── supabase/                 # Infrastructure as Code
│   └── functions/            # Deno Edge Functions
│       ├── _shared/          # Common utilities (auth.ts, cors.ts)
│       ├── generate-ai-insights/ # Claude integration pipeline
│       ├── process-audio-chunk/  # Deepgram interface
│       ├── process-video/        # Initial extraction logic
│       └── webhook-handler/      # External service webhooks
└── utils/                    # Helper Functions
    ├── formatters/           # Time and text formatting
    └── validators/           # Zod schemas (auth.ts, youtube.ts)
```

---

## ⚡ Core Features Implementation

### 1. Robust State Management & Data Fetching
The frontend utilizes a hybrid approach. **Zustand** (`store/useAuthStore.ts`, `store/useVideoStore.ts`) handles synchronous, global UI states (like dark mode or active selected text). **TanStack Query** (`hooks/queries/useVideoData.ts`) manages asynchronous server state, ensuring cache invalidation and background refetching are handled automatically.

### 2. The AI Insight Pipeline (Claude)
Once `process-audio-chunk` securely writes the Deepgram transcription to PostgreSQL, a database trigger calls `generate-ai-insights`. This function passes the raw context to Anthropic's Claude. Claude's superior context window allows it to process entire 2-hour podcasts in a single prompt to return perfectly structured JSON containing key takeaways, timestamps, and SEO-optimized descriptions.

### 3. Real-Time UI Synchronization
Using `hooks/queries/useRealtimeVideoStatus.ts`, the frontend subscribes to Supabase Postgres Changes. As the Edge Functions process the queue, the `GlassCard` UI components transition seamlessly using `components/animations/FadeIn.tsx` through exact states without client-side polling.

---
