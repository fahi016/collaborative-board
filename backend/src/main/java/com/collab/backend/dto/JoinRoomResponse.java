package com.collab.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class JoinRoomResponse {
    private boolean success;
    private String userName;
    private String userColor;
    private String sessionId;
}
