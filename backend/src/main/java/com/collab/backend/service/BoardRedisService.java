package com.collab.backend.service;

import com.collab.backend.dto.BoardActionMessage;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class BoardRedisService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    @Qualifier("boardRedisTemplate")
    private final RedisTemplate<String, String> boardRedisTemplate;
    private final ObjectMapper objectMapper;

    private String getKey(String roomId) {
        return "room:" + roomId + ":actions";
    }

    public void saveAction(String roomId, BoardActionMessage action) {
        try {
            String json = objectMapper.writeValueAsString(action);
            boardRedisTemplate.opsForList().rightPush(getKey(roomId), json);
            boardRedisTemplate.expire(getKey(roomId), Duration.ofHours(24));
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize board action", e);
        }
    }

    public List<Object> getAllActions(String roomId) {
        List<String> raw = boardRedisTemplate.opsForList().range(getKey(roomId), 0, -1);
        if (raw == null || raw.isEmpty()) {
            return List.of();
        }
        List<Object> result = new ArrayList<>();
        try {
            for (String s : raw) {
                result.add(objectMapper.readValue(s, MAP_TYPE));
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to deserialize board actions", e);
        }
        return result;
    }

    public void clearRoom(String roomId) {
        boardRedisTemplate.delete(getKey(roomId));
    }
}
