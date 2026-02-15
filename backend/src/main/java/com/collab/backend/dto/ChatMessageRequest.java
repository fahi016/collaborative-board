package com.collab.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
public class ChatMessageRequest {

    @NotBlank(message = "Message content is required")
    @Size(min = 1, max = 2000, message = "Message must be between 1 and 2000 characters")
    private String content;
}
