package com.collab.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
public class VoiceSignalRequest {

    public static final int MAX_SDP_LENGTH = 16_384;
    public static final int MAX_ICE_LENGTH = 1024;

    @NotBlank(message = "type is required")
    @Pattern(regexp = "offer|answer|ice-candidate", message = "type must be offer, answer, or ice-candidate")
    private String type;

    @NotBlank(message = "targetSessionId is required")
    @Size(max = 100)
    private String targetSessionId;

    @NotBlank(message = "payload is required")
    @Size(max = MAX_SDP_LENGTH)
    private String payload;
}