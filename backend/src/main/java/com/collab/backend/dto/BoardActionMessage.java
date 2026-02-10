package com.collab.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

@AllArgsConstructor
@Getter
@Setter
public class BoardActionMessage {
    private String type;// "draw", "text", "erase"
    private String userId;
    private String userName;
    private Long timestamp;
    private Map<String,Object> data;

    public BoardActionMessage() {
        this.timestamp = System.currentTimeMillis();
    }

}
