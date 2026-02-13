package com.collab.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
public class BoardActionMessage {

    @NotBlank(message = "type is required")
    private String type; // "draw", "text", "erase"

    @NotBlank(message = "userId is required")
    private String userId;

    @NotBlank(message = "userName is required")
    private String userName;

    @NotNull(message = "timestamp is required")
    private Long timestamp = System.currentTimeMillis();

    @NotNull(message = "data is required")
    @Size(max = 100, message = "Too many data entries")
    private Map<String, Object> data;
}
