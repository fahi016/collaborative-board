// src/hooks/useVoiceRoom.js
import { useRef, useCallback, useEffect } from 'react';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export function useVoiceRoom(
  roomId,
  users,
  currentUserName,
  mySessionId,
  onVoiceSignal
) {
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const isMutedRef = useRef(false);

  // 🔹 Get microphone stream
  const getLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      localStreamRef.current = stream;
      console.log('✅ Microphone access granted', stream.getAudioTracks());
      return stream;
    } catch (err) {
      console.error('❌ Microphone access denied:', err);
      throw new Error('Microphone access denied. Please allow microphone access and try again.');
    }
  }, []);

  // 🔹 Close a specific peer
  const closePeer = useCallback((sessionId) => {
    const pc = peerConnectionsRef.current[sessionId];
    if (pc) {
      console.log('Closing peer connection:', sessionId);
      pc.close();
      delete peerConnectionsRef.current[sessionId];
    }
  }, []);

  // 🔹 Create peer connection
  const createPeerConnection = useCallback(
    (remoteSessionId) => {
      // ✅ Safety check: Don't create peer to yourself
      if (remoteSessionId === mySessionId) {
        console.warn('Skipping peer connection to self');
        return null;
      }

      if (peerConnectionsRef.current[remoteSessionId]) {
        console.log('Reusing existing peer connection:', remoteSessionId);
        return peerConnectionsRef.current[remoteSessionId];
      }

      console.log('Creating new peer connection:', remoteSessionId);
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      // Add local tracks if available
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
          console.log('Added local track to peer:', remoteSessionId, track.kind);
        });
      }

      // Handle incoming remote tracks
      pc.ontrack = (e) => {
        console.log('✅ Track received from', remoteSessionId, e.streams[0]);

        const audio = document.getElementById(`remote-audio-${remoteSessionId}`);

        if (audio && e.streams[0]) {
          audio.srcObject = e.streams[0];
          
          // ✅ Attempt autoplay with fallback
          audio.play()
            .then(() => {
              console.log('✅ Playing audio from', remoteSessionId);
            })
            .catch((err) => {
              console.warn('⚠️ Autoplay blocked for', remoteSessionId, err);
              // User must interact with page for audio to play
            });
        } else {
          console.warn('⚠️ Audio element not found for', remoteSessionId);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          console.log('Sending ICE candidate to', remoteSessionId);
          onVoiceSignal({
            type: 'ice-candidate',
            targetSessionId: remoteSessionId,
            payload: JSON.stringify(e.candidate),
          });
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log(
          'Connection state with',
          remoteSessionId,
          '→',
          pc.connectionState
        );

        if (pc.connectionState === 'connected') {
          console.log('✅ Peer connected:', remoteSessionId);
        } else if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'disconnected'
        ) {
          console.warn('⚠️ Peer connection failed/disconnected:', remoteSessionId);
          closePeer(remoteSessionId);
        }
      };

      // Handle ICE connection state
      pc.oniceconnectionstatechange = () => {
        console.log(
          'ICE connection state with',
          remoteSessionId,
          '→',
          pc.iceConnectionState
        );
      };

      peerConnectionsRef.current[remoteSessionId] = pc;
      return pc;
    },
    [mySessionId, onVoiceSignal, closePeer] // ✅ Added mySessionId
  );

  // 🔹 Start voice
  const startVoice = useCallback(async () => {
    // ✅ Safety check
    if (!mySessionId) {
      console.warn('Cannot start voice: no sessionId yet');
      throw new Error('Session not ready. Please try again.');
    }

    console.log('Starting voice. My session:', mySessionId);

    // Get microphone access first
    await getLocalStream();

    // Find other users (exclude self)
    const others = users.filter((u) => u.sessionId && u.sessionId !== mySessionId);

    console.log('Creating offers for', others.length, 'users:', others);

    // Create peer connections and send offers to all other users
    for (const user of others) {
      console.log('Creating offer for', user.sessionId, user.userName);

      const pc = createPeerConnection(user.sessionId);
      if (!pc) continue;

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
        });
        await pc.setLocalDescription(offer);

        console.log('Sending offer to', user.sessionId);
        onVoiceSignal({
          type: 'offer',
          targetSessionId: user.sessionId,
          payload: pc.localDescription.sdp,
        });
      } catch (err) {
        console.error('Failed to create offer for', user.sessionId, err);
      }
    }
  }, [users, mySessionId, getLocalStream, createPeerConnection, onVoiceSignal]);

  // 🔹 Handle incoming signaling
  const handleIncomingSignal = useCallback(
    async (msg) => {
      const { type, payload, fromSessionId } = msg;

      console.log('Incoming signal:', type, 'from', fromSessionId);

      // ✅ Safety check
      if (!mySessionId) {
        console.warn('Cannot handle signal: no sessionId yet');
        return;
      }

      // ✅ Ignore signals from self
      if (fromSessionId === mySessionId) {
        console.warn('Ignoring signal from self');
        return;
      }

      const pc = createPeerConnection(fromSessionId);
      if (!pc) return;

      try {
        if (type === 'offer') {
          console.log('Handling offer from', fromSessionId);

          // Ensure we have local stream before answering
          if (!localStreamRef.current) {
            console.log('Getting local stream before answering');
            await getLocalStream();
            
            // Re-add tracks to this peer connection
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current);
              });
            }
          }

          await pc.setRemoteDescription({
            type: 'offer',
            sdp: payload,
          });

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          console.log('Sending answer to', fromSessionId);
          onVoiceSignal({
            type: 'answer',
            targetSessionId: fromSessionId,
            payload: pc.localDescription.sdp,
          });
        } else if (type === 'answer') {
          console.log('Handling answer from', fromSessionId);

          await pc.setRemoteDescription({
            type: 'answer',
            sdp: payload,
          });

          console.log('✅ Answer applied for', fromSessionId);
        } else if (type === 'ice-candidate') {
          console.log('Handling ICE candidate from', fromSessionId);

          try {
            const candidate =
              typeof payload === 'string' ? JSON.parse(payload) : payload;

            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('✅ ICE candidate added for', fromSessionId);
          } catch (err) {
            console.warn('Failed to add ICE candidate:', err);
          }
        }
      } catch (err) {
        console.error('Error handling signal from', fromSessionId, err);
      }
    },
    [mySessionId, createPeerConnection, onVoiceSignal, getLocalStream] // ✅ Added mySessionId
  );

  // 🔹 Mute toggle
  const setMuted = useCallback((muted) => {
    isMutedRef.current = muted;

    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });

    console.log(muted ? '🔇 Muted' : '🔊 Unmuted');
  }, []);

  // 🔹 Leave voice
  const leaveVoice = useCallback(() => {
    console.log('Leaving voice chat');

    // Close all peer connections
    Object.keys(peerConnectionsRef.current).forEach((sid) => {
      closePeer(sid);
    });

    // Stop local stream
    localStreamRef.current?.getTracks().forEach((t) => {
      t.stop();
      console.log('Stopped local track:', t.kind);
    });
    localStreamRef.current = null;

    console.log('✅ Left voice chat');
  }, [closePeer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveVoice();
    };
  }, [leaveVoice]);

  return {
    startVoice,
    leaveVoice,
    setMuted,
    handleIncomingSignal,
    getLocalStream,
  };
}