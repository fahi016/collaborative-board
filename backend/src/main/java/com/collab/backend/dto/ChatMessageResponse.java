package com.collab.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
public class ChatMessageResponse {

    private Long id;
    private String roomId;
    private Long senderId;
    private String senderName;
    private String content;
    private LocalDateTime createdAt;
}
