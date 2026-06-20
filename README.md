# Excaliber

AI-powered drawing engine built on Excalidraw, Groq, and MongoDB.

## Phase 9.0.2 — Clean Image Embedding

When you use "show me [subject]" intent, the actual Pexels photo now
appears on the canvas as part of the diagram rather than just influencing
the label text.

### How it looks
The photo is placed centered on the canvas inside a rounded frame.
Annotation nodes (sourced from the AI's diagram plan) are arranged in a
clean radial ring around the image with dashed inward-pointing arrows.
A small "Photo: Pexels" credit appears below the image.
The result looks like a textbook reference diagram, not a stock photo
pasted onto a canvas.

### Technical pipeline
  1. Server calls Pexels API -> gets image URL
  2. Server downloads image binary (capped at 150KB)
  3. Binary converted to base64, sent in chat response as embeddedImages[]
  4. Client calls excalidrawAPI.addFiles() to register the image
  5. Image element placed at canvas center using Excalidraw's native files API
  6. Annotation nodes repositioned radially using computed geometry
  7. Dashed arrows added from each annotation pointing inward to image

### No MCP required
The Excalidraw MCP does not have an add_image tool. This pipeline uses
Excalidraw's native JavaScript files API (excalidrawAPI.addFiles) which
is available in the @excalidraw/excalidraw React component directly.

## Phase 9.0.4 — Conversation Semantic State

The AI now maintains a structured semantic context across turns in a
conversation instead of re-inferring everything from scratch on each request.

### What's tracked
  - Domain (networking, software/backend, biology, etc.)
  - Diagram type (tcp-handshake, microservices-architecture, etc.)
  - Established entities — every drawn node with its actual scene id
  - Layout conventions — which layout and direction were used before
  - Open threads — entities mentioned but not yet drawn
  - Turn count

### How it works
Semantic state is client-owned and round-tripped on every request (same
pattern as sceneJson). The client sends its current state, the server
injects it into the generation prompt, updates it based on what was
classified and drawn, and returns the updated state. No server-side
memory required.

### What it enables
  - "add error handling" works correctly in context without re-describing the system
  - Follow-up requests reference established node ids directly instead of guessing
  - Open threads like "we'll add TLS later" are tracked and surfaced when relevant
  - Layout and theme conventions persist without the user re-specifying them

### Persistence
Semantic state is saved alongside the drawing in MongoDB and restored when
a saved drawing is loaded, so context survives page reloads.

### New environment variables
None — no new configuration required.
