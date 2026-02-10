package com.collab.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config){

        // Enable a simple in-memory message broker
        // Prefix for messages going FROM server TO client
        config.enableSimpleBroker("/topic");

        // Prefix for messages going FROM client TO server
        config.setApplicationDestinationPrefixes("/app");

    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry){

        // Register STOMP endpoint that clients will connect to
        registry.addEndpoint("/ws")
//                .setAllowedOrigins("http://localhost:5173", "http://localhost:3000")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }


}
