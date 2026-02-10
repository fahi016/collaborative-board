package com.collab.backend.exception;

public class RoomFullException extends RuntimeException {
    public RoomFullException(String message) {
        super(message);
    }

    public RoomFullException(String message, Throwable cause) {
        super(message, cause);
    }
}