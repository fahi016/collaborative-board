package com.collab.backend.service;

import com.collab.backend.dto.VoiceSignalRequest;
import com.collab.backend.model.ActiveUser;
import com.collab.backend.model.Room;
import com.collab.backend.repository.ActiveUserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class VoiceSignalingService {

    private static final Logger logger = LoggerFactory.getLogger(VoiceSignalingService.class);
    private static final String VOICE_SIGNAL_QUEUE = "/queue/voice-signal";

    private final SimpMessagingTemplate messagingTemplate;
    private final ActiveUserRepository activeUserRepository;
    private final RoomService roomService;

    /**
     * Relay a WebRTC signal (offer/answer/ice-candidate) from sender to the peer identified by targetSessionId.
     * Both must be in the same room.
     */
    public void relaySignal(String roomId, String senderSessionId, String senderUsername, VoiceSignalRequest request) {
        validateRoomAndSender(roomId, senderSessionId);

        Room room = roomService.getRoomById(roomId);
        Optional<ActiveUser> targetOpt = activeUserRepository.findByRoomAndSessionId(room, request.getTargetSessionId());
        if (targetOpt.isEmpty()) {
            logger.warn("Voice signal target not in room: roomId={}, targetSessionId={}", roomId, request.getTargetSessionId());
            throw new IllegalArgumentException("Target peer not found in room");
        }
        String targetUsername = targetOpt.get().getUserName();

        Object payload = Map.of(
                "type", request.getType(),
                "payload", request.getPayload(),
                "fromSessionId", senderSessionId,
                "fromUserName", senderUsername
        );
        messagingTemplate.convertAndSendToUser(targetUsername, VOICE_SIGNAL_QUEUE, payload);
        logger.debug("Relayed voice signal type={} roomId={} from={} to={}", request.getType(), roomId, senderUsername, targetUsername);
    }

    private void validateRoomAndSender(String roomId, String sessionId) {
        if (!activeUserRepository.existsByRoom_RoomIdAndSessionId(roomId, sessionId)) {
            throw new IllegalStateException("Sender not in room");
        }
    }
}