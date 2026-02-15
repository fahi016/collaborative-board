# How to Test WebRTC Voice in a Room

This guide explains how to manually test the voice feature (WebRTC audio + mic on/off) in the Collaborative Board app.

## Prerequisites

- **Backend** running (e.g. `mvn spring-boot:run` in `backend/`, or your usual run config).
- **Frontend** running (e.g. `npm run dev` in `frontend/`).
- **Browser**: Use a modern browser with WebRTC support (Chrome, Firefox, Edge). For multi-user tests you need at least two **separate** browser sessions (e.g. two Chrome windows, or Chrome + Firefox, or one normal + one incognito).
- **Microphone**: A working mic so the browser can request permission.

## 1. Create / join a room (two users)

1. Log in as **User A** (e.g. `alice@test.com`).
2. Create a room or open “My Rooms” and note the **Room ID**.
3. Open the room so you see the board and the TopBar with **“Join voice”**.
4. In a **second** browser (or incognito), log in as **User B** (e.g. `bob@test.com`).
5. Join the **same room** (paste Room ID or use “Join room”). You should see both users in the **Online** list (e.g. “Online: Alice (You), Bob” on one side and “Alice, Bob (You)” on the other).

## 2. Join voice (both users)

1. In **User A’s** window: click **“Join voice”** in the TopBar.
   - Browser will ask for **microphone permission** → allow.
   - You should see a toast like “Voice joined” and the TopBar should show **“Mute”** and **“Leave voice”**.
2. In **User B’s** window: click **“Join voice”** as well.
   - Allow mic if prompted; “Mute” and “Leave voice” appear.

After both have joined, **audio should flow between the two**: talk in one tab and you should hear it in the other (and vice versa).

## 3. Test mic on/off (mute / unmute)

1. With both in voice, in **User A’s** window click **“Mute”**.
   - User A’s mic is muted; the other user should **stop** hearing A.
   - In **User B’s** “Online” list, the small mic icon next to User A should show as **muted** (mic-off style).
2. Click **“Unmute”** for User A.
   - User B should hear A again, and the mic icon next to A on B’s side should show as **speaking** (mic-on style).
3. Repeat from **User B’s** side: mute/unmute and confirm A sees B’s mic state and hears/doesn’t hear B.

## 4. Leave voice and rejoin

1. In one window click **“Leave voice”**.
   - That user should no longer send or receive voice; the other user may hear a short drop.
   - The one who left no longer has “Join voice” replaced by “Mute”/“Leave voice”.
2. Click **“Join voice”** again.
   - Mic permission may already be granted; voice should work again between the two.

## 5. Exit room and cleanup

1. In one window click **“Exit Room”**.
   - That user leaves the room and voice is cleaned up.
2. In the other window you should see the user list update (one user left). If that user had been in voice, their remote audio stops.

## 6. Single user (sanity check)

1. Open a room with **only one** user (no second browser).
2. Click **“Join voice”**.
   - You should get “Voice joined” and see “Mute” / “Leave voice”. No errors in console.
   - There are no other peers, so no one else will hear you; that’s expected.
3. Toggle **Mute** / **Unmute** and **Leave voice** to confirm the UI and mic state work.

## 7. Optional: three users (if your room allows 3)

1. Log in as three different users in three browsers/windows and join the **same room**.
2. All three click **“Join voice”**.
3. Confirm:
   - Each user can hear the other two.
   - Mute/unmute for any user is reflected in the other two’s “Online” list (mic icon).
   - Leaving voice for one user only removes that user from the voice mesh; the other two still hear each other.

## Troubleshooting

- **No audio**
  - Check browser mic permission (lock icon in address bar or site settings).
  - Check system mic and volume; try another app (e.g. system sound settings) to confirm the mic works.
  - Open DevTools → Console for errors; open **Application** (Chrome) / **Storage** (Firefox) and ensure no cookie/localStorage issue blocking the WebSocket or auth.

- **“Join voice” does nothing or errors**
  - Ensure you’re **in a room** and the **Online** list shows at least your user (so `currentSessionId` is set). Refresh and re-join the room if needed.
  - Ensure backend is up and WebSocket connects (green “Connected” in TopBar). Check backend logs for voice-signal or voice/mic errors.

- **Other user never hears me / I never hear them**
  - Both users must click **“Join voice”**; signaling is per-room and per-user.
  - If behind strict NAT/corporate firewall, WebRTC might need TURN; for local/dev, STUN is usually enough. Check console for ICE/WebRTC errors.

- **Mic icon not updating**
  - Mic state is broadcast over `/topic/room/{roomId}/users`. Ensure both clients are subscribed and that you’re not filtering out `voice-mic` messages in the user-list handler.

## Quick checklist

| Step                         | What to do                          | Expected result                          |
|-----------------------------|-------------------------------------|------------------------------------------|
| Two users in same room      | Join same room from two browsers    | Both see each other in Online list       |
| Join voice (A)              | Click “Join voice” as User A        | A sees Mute / Leave voice; no errors     |
| Join voice (B)              | Click “Join voice” as User B        | B sees Mute / Leave voice; A and B hear   |
| Mute A                      | A clicks “Mute”                     | B stops hearing A; B sees A as muted      |
| Unmute A                    | A clicks “Unmute”                   | B hears A again; B sees A as speaking     |
| Leave voice (A)             | A clicks “Leave voice”              | A exits voice; B no longer hears A       |
| Exit room (A)               | A clicks “Exit Room”                | B’s user list updates; B’s voice still on|

Once these pass, the frontend voice implementation (WebRTC + mic on/off) is working as intended.
