package com.collab.backend.controller;

import com.collab.backend.dto.ChatMessageResponse;
import com.collab.backend.service.AuthService;
import com.collab.backend.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST API for chat message history. Real-time send is via WebSocket /app/room/{roomId}/chat.
 */
@RestController
@RequestMapping("/api/rooms/{roomId}/messages")
@RequiredArgsConstructor
public class ChatController {

    private static final Logger logger = LoggerFactory.getLogger(ChatController.class);

    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;

    private final ChatService chatService;
    private final AuthService authService;

    /**
     * Get paginated chat history for a room. User must be authenticated.
     * Access control: room must exist (finer-grained checks can be added later).
     */
    @GetMapping
    public ResponseEntity<Page<ChatMessageResponse>> getMessages(
            @PathVariable String roomId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        authService.getCurrentUser(); // ensure authenticated

        if (size <= 0 || size > MAX_PAGE_SIZE) {
            size = DEFAULT_PAGE_SIZE;
        }
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        // Room existence is validated inside ChatService
        Page<ChatMessageResponse> messages = chatService.getMessages(roomId, pageable);
        logger.debug("Chat history requested roomId={} page={} size={}", roomId, page, size);
        return ResponseEntity.ok(messages);
    }
}
