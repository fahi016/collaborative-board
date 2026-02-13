package com.collab.backend.service;

import com.collab.backend.dto.BoardActionMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BoardRedisService {
    private final RedisTemplate<String,Object> redisTemplate;

    private String getKey(String roomId) {
        return "room:" + roomId + ":actions";
    }

    public void saveAction(String roomId, BoardActionMessage action) {
        redisTemplate.opsForList().rightPush(getKey(roomId), action);
        redisTemplate.expire(getKey(roomId), Duration.ofHours(24));
    }

    public List<Object> getAllActions(String roomId) {
        return redisTemplate.opsForList().range(getKey(roomId), 0, -1);
    }

    public void clearRoom(String roomId) {
        redisTemplate.delete(getKey(roomId));
    }
}
