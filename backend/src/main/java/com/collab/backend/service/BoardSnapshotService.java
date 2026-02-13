package com.collab.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
@Service
@RequiredArgsConstructor
public class BoardSnapshotService {
    private final RedisTemplate<String, Object> redisTemplate;
    private final BoardService boardService;
    private final ObjectMapper objectMapper;


    @Scheduled(fixedRate = 15000)
    public void snapshotAllRooms() {

        Set<String> keys = redisTemplate.keys("room:*:actions");
        if (keys == null || keys.isEmpty()) return;

        for (String key : keys) {

            String roomId = key.split(":")[1];

            List<Object> actions =
                    redisTemplate.opsForList().range(key, 0, -1);

            if (actions == null || actions.isEmpty()) continue;

            try {
                String json = objectMapper
                        .writeValueAsString(actions);

                boardService.updateBoardState(roomId, 1, json);

            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

}
