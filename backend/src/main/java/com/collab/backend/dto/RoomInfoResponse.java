package com.collab.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class RoomInfoResponse {
    private String roomId;
    private Integer currentUsers;
    private Integer maxUsers;
    private LocalDateTime createdAt;
    private boolean isFull;
}
