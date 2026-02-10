package com.collab.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@AllArgsConstructor
@Getter
@Setter
public class UserMessage {

    private String type; // "join" or "leave"
    private String userName;
    private String sessionId;
    private String color;
    private Long timestamp;

    public UserMessage(String type, String userName, String sessionId, String color) {
        this.type = type;
        this.userName = userName;
        this.sessionId = sessionId;
        this.color = color;
        this.timestamp = System.currentTimeMillis();
    }

    public UserMessage() {
        this.timestamp = System.currentTimeMillis();
    }
}
