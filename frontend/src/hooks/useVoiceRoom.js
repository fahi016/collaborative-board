import { useRef, useCallback, useEffect, useState } from 'react';
import { logger } from '../utils/logger';

const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const DISCONNECTED_GRACE_MS = 8000;

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
const toAudioElementId = (sessionId) => `remote-audio-${sessionId}`;

export function useVoiceRoom(roomId, users, mySessionId, onVoiceSignal) {
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const isMutedRef = useRef(false);
  const blockedAudioElementsRef = useRef(new Set());
  const remoteAudioElementsRef = useRef({});
  const pendingIceCandidatesRef = useRef({});
  const makingOfferRef = useRef({});
  const ignoreOfferRef = useRef({});
  const disconnectTimersRef = useRef({});
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const clearDisconnectTimer = useCallback((sessionId) => {
    const timer = disconnectTimersRef.current[sessionId];
    if (!timer) return;
    clearTimeout(timer);
    delete disconnectTimersRef.current[sessionId];
  }, []);

  const isPolitePeer = useCallback((remoteSessionId) => {
    if (!mySessionId || !remoteSessionId) return true;
    return mySessionId > remoteSessionId;
  }, [mySessionId]);

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

  const removeRemoteAudioElement = useCallback((remoteSessionId) => {
    const known = remoteAudioElementsRef.current[remoteSessionId];
    const audioEl = known || document.getElementById(toAudioElementId(remoteSessionId));
    if (!audioEl) return;

    clearAudioBlocked(audioEl);
    audioEl.pause?.();
    audioEl.srcObject = null;

    if (audioEl.dataset.managedByVoiceHook === 'true') {
      audioEl.remove();
    }

    delete remoteAudioElementsRef.current[remoteSessionId];
  }, [clearAudioBlocked]);

  const ensureRemoteAudioElement = useCallback((remoteSessionId) => {
    const id = toAudioElementId(remoteSessionId);
    const existing = remoteAudioElementsRef.current[remoteSessionId] || document.getElementById(id);
    if (existing) {
      remoteAudioElementsRef.current[remoteSessionId] = existing;
      return existing;
    }

    const audio = document.createElement('audio');
    audio.id = id;
    audio.autoplay = true;
    audio.playsInline = true;
    audio.className = 'hidden';
    audio.dataset.managedByVoiceHook = 'true';
    document.body.appendChild(audio);
    remoteAudioElementsRef.current[remoteSessionId] = audio;
    return audio;
  }, []);

  const addLocalTracksToPeer = useCallback((pc, remoteSessionId) => {
    if (!pc || !localStreamRef.current) return;

    const senderTrackIds = new Set(
      pc.getSenders()
        .map((sender) => sender.track?.id)
        .filter(Boolean)
    );

    localStreamRef.current.getTracks().forEach((track) => {
      if (senderTrackIds.has(track.id)) return;
      pc.addTrack(track, localStreamRef.current);
      logger.debug('Added local track to peer:', remoteSessionId, track.kind);
    });
  }, []);

  const flushPendingIceCandidates = useCallback(async (sessionId, pc) => {
    const pending = pendingIceCandidatesRef.current[sessionId];
    if (!pending || pending.length === 0) return;

    logger.debug('Flushing queued ICE candidates for', sessionId, 'count=', pending.length);
    delete pendingIceCandidatesRef.current[sessionId];

    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        logger.warn('Failed to add queued ICE candidate for', sessionId, err);
      }
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

      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMutedRef.current;
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
    clearDisconnectTimer(sessionId);

    const pc = peerConnectionsRef.current[sessionId];
    if (pc) {
      logger.debug('Closing peer connection:', sessionId);
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
      delete peerConnectionsRef.current[sessionId];
    }

    delete pendingIceCandidatesRef.current[sessionId];
    delete makingOfferRef.current[sessionId];
    delete ignoreOfferRef.current[sessionId];
    removeRemoteAudioElement(sessionId);
  }, [clearDisconnectTimer, removeRemoteAudioElement]);

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

      addLocalTracksToPeer(pc, remoteSessionId);

      pc.ontrack = (e) => {
        logger.debug('Track received from', remoteSessionId, e.streams[0]);

        const audio = ensureRemoteAudioElement(remoteSessionId);
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
          clearDisconnectTimer(remoteSessionId);
          logger.debug('Peer connected:', remoteSessionId);
        } else if (pc.connectionState === 'disconnected') {
          if (!disconnectTimersRef.current[remoteSessionId]) {
            disconnectTimersRef.current[remoteSessionId] = setTimeout(() => {
              const currentPc = peerConnectionsRef.current[remoteSessionId];
              if (!currentPc) return;
              if (
                currentPc.connectionState === 'disconnected' ||
                currentPc.connectionState === 'failed' ||
                currentPc.connectionState === 'closed'
              ) {
                logger.warn('Peer remained disconnected, closing:', remoteSessionId);
                closePeer(remoteSessionId);
              }
            }, DISCONNECTED_GRACE_MS);
          }
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          logger.warn('Peer connection failed/closed:', remoteSessionId);
          closePeer(remoteSessionId);
        }
      };

      pc.oniceconnectionstatechange = () => {
        logger.debug('ICE connection state with', remoteSessionId, '->', pc.iceConnectionState);
      };

      peerConnectionsRef.current[remoteSessionId] = pc;
      return pc;
    },
    [
      mySessionId,
      onVoiceSignal,
      closePeer,
      clearAudioBlocked,
      markAudioBlocked,
      addLocalTracksToPeer,
      ensureRemoteAudioElement,
      clearDisconnectTimer,
    ]
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

      makingOfferRef.current[user.sessionId] = true;
      try {
        addLocalTracksToPeer(pc, user.sessionId);
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        if (pc.signalingState !== 'stable') {
          logger.warn('Skipping unstable offer for', user.sessionId, pc.signalingState);
          continue;
        }
        await pc.setLocalDescription(offer);

        logger.debug('Sending offer to', user.sessionId);
        onVoiceSignal({
          type: 'offer',
          targetSessionId: user.sessionId,
          payload: pc.localDescription.sdp,
        });
      } catch (err) {
        logger.error('Failed to create offer for', user.sessionId, err);
      } finally {
        makingOfferRef.current[user.sessionId] = false;
      }
    }
  }, [users, mySessionId, getLocalStream, createPeerConnection, onVoiceSignal, addLocalTracksToPeer]);

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
          }

          addLocalTracksToPeer(pc, fromSessionId);

          const offerCollision =
            Boolean(makingOfferRef.current[fromSessionId]) || pc.signalingState !== 'stable';
          ignoreOfferRef.current[fromSessionId] = !isPolitePeer(fromSessionId) && offerCollision;

          if (ignoreOfferRef.current[fromSessionId]) {
            logger.warn('Ignoring offer collision from', fromSessionId);
            return;
          }

          if (offerCollision && pc.signalingState === 'have-local-offer') {
            logger.warn('Offer collision detected with', fromSessionId, '- rolling back local offer');
            await Promise.all([
              pc.setLocalDescription({ type: 'rollback' }),
              pc.setRemoteDescription({ type: 'offer', sdp: payload }),
            ]);
          } else {
            await pc.setRemoteDescription({ type: 'offer', sdp: payload });
          }
          await flushPendingIceCandidates(fromSessionId, pc);

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
          await flushPendingIceCandidates(fromSessionId, pc);
          logger.debug('Answer applied for', fromSessionId);
        } else if (type === 'ice-candidate') {
          logger.debug('Handling ICE candidate from', fromSessionId);

          const candidate = typeof payload === 'string' ? JSON.parse(payload) : payload;
          if (!candidate) return;

          if (ignoreOfferRef.current[fromSessionId]) {
            logger.debug('Skipping ICE candidate for ignored offer from', fromSessionId);
            return;
          }

          if (!pc.remoteDescription || !pc.remoteDescription.type) {
            const existing = pendingIceCandidatesRef.current[fromSessionId] || [];
            existing.push(candidate);
            pendingIceCandidatesRef.current[fromSessionId] = existing;
            logger.debug('Queued ICE candidate until remote description is set for', fromSessionId);
            return;
          }

          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            logger.debug('ICE candidate added for', fromSessionId);
          } catch (err) {
            logger.warn('Failed to add ICE candidate for', fromSessionId, err);
          }
        }
      } catch (err) {
        logger.error('Error handling signal from', fromSessionId, err);
      }
    },
    [
      mySessionId,
      createPeerConnection,
      onVoiceSignal,
      getLocalStream,
      addLocalTracksToPeer,
      isPolitePeer,
      flushPendingIceCandidates,
    ]
  );

  const setMuted = useCallback((muted) => {
    isMutedRef.current = muted;

    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });

    logger.debug(muted ? 'Muted' : 'Unmuted');
  }, []);

  const leaveVoice = useCallback(() => {
    logger.debug('Leaving voice chat for room', roomId);

    Object.keys(peerConnectionsRef.current).forEach((sid) => {
      closePeer(sid);
    });

    localStreamRef.current?.getTracks().forEach((t) => {
      t.stop();
      logger.debug('Stopped local track:', t.kind);
    });
    localStreamRef.current = null;

    Object.keys(remoteAudioElementsRef.current).forEach((sid) => {
      removeRemoteAudioElement(sid);
    });

    blockedAudioElementsRef.current.clear();
    setAutoplayBlocked(false);

    logger.debug('Left voice chat');
  }, [closePeer, roomId, removeRemoteAudioElement]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasTurn = ICE_SERVERS.some((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.some((url) => typeof url === 'string' && url.startsWith('turn:'));
    });
    const host = window.location?.hostname || '';
    const localHost = host === 'localhost' || host === '127.0.0.1';
    if (!hasTurn && !localHost) {
      logger.warn(
        'Voice is running without TURN servers. Some users behind strict NAT/firewalls may have intermittent or one-way audio.'
      );
    }
  }, []);

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
