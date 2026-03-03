import { useRef, useCallback, useEffect, useState } from 'react';
import { logger } from '../utils/logger';

const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const resolveIceServers = () => {
  
  const raw = import.meta.env.VITE_ICE_SERVERS;
  if (!raw) return DEFAULT_ICE_SERVERS;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_ICE_SERVERS;
    }

    const valid = parsed.filter((s) => s && typeof s === 'object' && s.urls);
    return valid.length > 0 ? valid : DEFAULT_ICE_SERVERS;
  } catch {
    logger.warn('Invalid VITE_ICE_SERVERS JSON. Falling back to default STUN server.');
    return DEFAULT_ICE_SERVERS;
  }
};

const ICE_SERVERS = resolveIceServers();

export function useVoiceRoom(roomId, users, mySessionId, onVoiceSignal) {
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const isMutedRef = useRef(false);
  const blockedAudioElementsRef = useRef(new Set());
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const markAudioBlocked = useCallback((audioEl) => {
    if (!audioEl) return;
    blockedAudioElementsRef.current.add(audioEl);
    setAutoplayBlocked(true);
  }, []);

  const clearAudioBlocked = useCallback((audioEl) => {
    if (!audioEl) return;
    blockedAudioElementsRef.current.delete(audioEl);
    if (blockedAudioElementsRef.current.size === 0) {
      setAutoplayBlocked(false);
    }
  }, []);

  const enableAudioPlayback = useCallback(async () => {
    const blocked = Array.from(blockedAudioElementsRef.current);
    if (blocked.length === 0) {
      setAutoplayBlocked(false);
      return true;
    }

    let allSucceeded = true;
    for (const audio of blocked) {
      try {
        await audio.play();
        blockedAudioElementsRef.current.delete(audio);
      } catch {
        allSucceeded = false;
      }
    }

    setAutoplayBlocked(blockedAudioElementsRef.current.size > 0);
    return allSucceeded;
  }, []);

  const getLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      localStreamRef.current = stream;
      logger.debug('Microphone access granted', stream.getAudioTracks());
      return stream;
    } catch (err) {
      logger.error('Microphone access denied:', err);
      throw new Error('Microphone access denied. Please allow microphone access and try again.');
    }
  }, []);

  const closePeer = useCallback((sessionId) => {
    const pc = peerConnectionsRef.current[sessionId];
    if (pc) {
      logger.debug('Closing peer connection:', sessionId);
      pc.close();
      delete peerConnectionsRef.current[sessionId];
    }
  }, []);

  const createPeerConnection = useCallback(
    (remoteSessionId) => {
      if (remoteSessionId === mySessionId) {
        logger.warn('Skipping peer connection to self');
        return null;
      }

      if (peerConnectionsRef.current[remoteSessionId]) {
        logger.debug('Reusing existing peer connection:', remoteSessionId);
        return peerConnectionsRef.current[remoteSessionId];
      }

      logger.debug('Creating new peer connection:', remoteSessionId);
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
          logger.debug('Added local track to peer:', remoteSessionId, track.kind);
        });
      }

      pc.ontrack = (e) => {
        logger.debug('Track received from', remoteSessionId, e.streams[0]);

        const audio = document.getElementById(`remote-audio-${remoteSessionId}`);
        if (audio && e.streams[0]) {
          audio.srcObject = e.streams[0];

          audio.play()
            .then(() => {
              clearAudioBlocked(audio);
              logger.debug('Playing audio from', remoteSessionId);
            })
            .catch((err) => {
              markAudioBlocked(audio);
              logger.warn('Autoplay blocked for', remoteSessionId, err);
            });
        } else {
          logger.warn('Audio element not found for', remoteSessionId);
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          logger.debug('Sending ICE candidate to', remoteSessionId);
          onVoiceSignal({
            type: 'ice-candidate',
            targetSessionId: remoteSessionId,
            payload: JSON.stringify(e.candidate),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        logger.debug('Connection state with', remoteSessionId, '->', pc.connectionState);

        if (pc.connectionState === 'connected') {
          logger.debug('Peer connected:', remoteSessionId);
        } else if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'disconnected'
        ) {
          logger.warn('Peer connection failed/disconnected:', remoteSessionId);
          closePeer(remoteSessionId);
        }
      };

      pc.oniceconnectionstatechange = () => {
        logger.debug('ICE connection state with', remoteSessionId, '->', pc.iceConnectionState);
      };

      peerConnectionsRef.current[remoteSessionId] = pc;
      return pc;
    },
    [mySessionId, onVoiceSignal, closePeer, clearAudioBlocked, markAudioBlocked]
  );

  const startVoice = useCallback(async () => {
    if (!mySessionId) {
      logger.warn('Cannot start voice: no sessionId yet');
      throw new Error('Session not ready. Please try again.');
    }

    logger.debug('Starting voice. My session:', mySessionId);
    await getLocalStream();

    const others = users.filter((u) => u.sessionId && u.sessionId !== mySessionId);
    logger.debug('Creating offers for', others.length, 'users:', others);

    for (const user of others) {
      logger.debug('Creating offer for', user.sessionId, user.userName);

      const pc = createPeerConnection(user.sessionId);
      if (!pc) continue;

      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);

        logger.debug('Sending offer to', user.sessionId);
        onVoiceSignal({
          type: 'offer',
          targetSessionId: user.sessionId,
          payload: pc.localDescription.sdp,
        });
      } catch (err) {
        logger.error('Failed to create offer for', user.sessionId, err);
      }
    }
  }, [users, mySessionId, getLocalStream, createPeerConnection, onVoiceSignal]);

  const handleIncomingSignal = useCallback(
    async (msg) => {
      const { type, payload, fromSessionId } = msg;

      logger.debug('Incoming signal:', type, 'from', fromSessionId);

      if (!mySessionId) {
        logger.warn('Cannot handle signal: no sessionId yet');
        return;
      }

      if (fromSessionId === mySessionId) {
        logger.warn('Ignoring signal from self');
        return;
      }

      const pc = createPeerConnection(fromSessionId);
      if (!pc) return;

      try {
        if (type === 'offer') {
          logger.debug('Handling offer from', fromSessionId);

          if (!localStreamRef.current) {
            logger.debug('Getting local stream before answering');
            await getLocalStream();

            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current);
              });
            }
          }

          await pc.setRemoteDescription({ type: 'offer', sdp: payload });

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          logger.debug('Sending answer to', fromSessionId);
          onVoiceSignal({
            type: 'answer',
            targetSessionId: fromSessionId,
            payload: pc.localDescription.sdp,
          });
        } else if (type === 'answer') {
          logger.debug('Handling answer from', fromSessionId);

          await pc.setRemoteDescription({ type: 'answer', sdp: payload });
          logger.debug('Answer applied for', fromSessionId);
        } else if (type === 'ice-candidate') {
          logger.debug('Handling ICE candidate from', fromSessionId);

          try {
            const candidate = typeof payload === 'string' ? JSON.parse(payload) : payload;
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            logger.debug('ICE candidate added for', fromSessionId);
          } catch (err) {
            logger.warn('Failed to add ICE candidate:', err);
          }
        }
      } catch (err) {
        logger.error('Error handling signal from', fromSessionId, err);
      }
    },
    [mySessionId, createPeerConnection, onVoiceSignal, getLocalStream]
  );

  const setMuted = useCallback((muted) => {
    isMutedRef.current = muted;

    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });

    logger.debug(muted ? 'Muted' : 'Unmuted');
  }, []);

  const leaveVoice = useCallback(() => {
    logger.debug('Leaving voice chat');

    Object.keys(peerConnectionsRef.current).forEach((sid) => {
      closePeer(sid);
    });

    localStreamRef.current?.getTracks().forEach((t) => {
      t.stop();
      logger.debug('Stopped local track:', t.kind);
    });
    localStreamRef.current = null;

    blockedAudioElementsRef.current.clear();
    setAutoplayBlocked(false);

    logger.debug('Left voice chat');
  }, [closePeer]);

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
    autoplayBlocked,
    enableAudioPlayback,
  };
}
