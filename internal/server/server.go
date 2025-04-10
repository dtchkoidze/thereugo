package server

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func webSocketHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println("Error upgrading:", err)
		return
	}
	defer conn.Close()

	conn.SetReadDeadline(time.Now().Add(50 * time.Second))

	for {
		messageType, message, err := conn.ReadMessage()
		if err != nil {
			fmt.Println("Error reading message:", err)
			break
		}

		if messageType == websocket.TextMessage {
			var msg map[string]interface{}
			if err := json.Unmarshal(message, &msg); err == nil {
				if msg["type"] == "ping" {
					conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"pong"}`))
					conn.SetReadDeadline(time.Now().Add(50 * time.Second))
					continue
				}
			}
		}

		fmt.Printf("Received: %s\n", message)
		if err := conn.WriteMessage(messageType, message); err != nil {
			fmt.Println("Error writing message:", err)
			break
		}

		conn.SetReadDeadline(time.Now().Add(50 * time.Second))
	}
}

func Start(addr string) {

	mux := http.NewServeMux()

	mux.HandleFunc("/ws", webSocketHandler)

	fs := http.FileServer(http.Dir("ui/static"))
	mux.Handle("/", fs)

	log.Println("ThereUGO server running at", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
