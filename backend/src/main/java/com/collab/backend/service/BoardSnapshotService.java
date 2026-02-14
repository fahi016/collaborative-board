package com.collab.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class BoardSnapshotService {

    private static final Logger logger = LoggerFactory.getLogger(BoardSnapshotService.class);
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    @Qualifier("boardRedisTemplate")
    private final RedisTemplate<String, String> boardRedisTemplate;
    private final BoardService boardService;
    private final ObjectMapper objectMapper;

    @Scheduled(fixedRate = 15000)
    public void snapshotAllRooms() {

        Set<String> keys = boardRedisTemplate.keys("room:*:actions");
        if (keys == null || keys.isEmpty()) {
            return;
        }

        for (String key : keys) {

            String[] parts = key.split(":");
            if (parts.length < 2) {
                logger.warn("Skipping malformed Redis key: {}", key);
                continue;
            }

            String roomId = parts[1];

            List<String> raw = boardRedisTemplate.opsForList().range(key, 0, -1);

            if (raw == null || raw.isEmpty()) {
                continue;
            }

            try {
                List<Map<String, Object>> parsed = raw.stream()
                        .map(s -> {
                            try {
                                return objectMapper.readValue(s, MAP_TYPE);
                            } catch (Exception e) {
                                throw new RuntimeException(e);
                            }
                        })
                        .toList();
                String json = objectMapper.writeValueAsString(parsed);
                boardService.updateBoardState(roomId, BoardService.DEFAULT_PAGE, json);
            } catch (Exception e) {
                logger.error("Failed to snapshot board state for room {}", roomId, e);
            }
        }
    }
}
