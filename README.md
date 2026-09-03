<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d39fc385-5851-46eb-b470-0284a2e95b31

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Multiplayer social features

The game now includes:
- server-authoritative room/game validation
- temporary reconnect grace period with AI takeover after disconnect timeout
- host transfer safeguards
- validated lobby settings and Wild color selection
- real-time room text chat with emoji shortcuts and basic anti-spam
- quick in-game emoji reactions
- browser WebRTC voice chat using Socket.IO only for signaling
- microphone mute/deafen controls

### WebRTC note
Voice is peer-to-peer and uses public STUN servers by default. Some corporate/mobile/NAT networks may require a TURN relay for reliable connectivity; the environment variables above are reserved for that future configuration.

## Latest stability/UI pass
- Tiny floating Chat button on the right and Voice/Call button on the left; panels open as overlays and never take layout space.
- Mobile-safe chat/voice drawers with compact controls.
- Fixed turn-timeout double-advance bug.
- Fixed initial special-card opening inconsistency by starting from a neutral number card.
- Fixed UNO auto-call/duplicate-event behavior and restricted UNO calls to the active player.
- Fixed UNO state reset after drawing back above one card.
- Fixed empty draw-pile behavior so the server does not manufacture duplicate cards.
- Added WebRTC ICE-candidate queuing for more reliable voice setup.
- Added cleanup for chat/reaction rate-limit state when players leave.
- Updated footer credit to: ⚡Built & Designed by "FARDEEN KHAN"
