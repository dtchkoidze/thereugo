package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type PeerMessage struct {
	To   string          `json:"to"`
	From string          `json:"from"`
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type Server struct {
	peers   map[string]*websocket.Conn
	peersMu sync.RWMutex
}

func NewServer() *Server {
	return &Server{
		peers: make(map[string]*websocket.Conn),
	}
}

func (s *Server) Handle(w http.ResponseWriter, r *http.Request) {
	peerID := r.URL.Query().Get("id")
	if peerID == "" {
		log.Println("missing peer id")
		http.Error(w, "Missing peer ID", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	defer conn.Close()

	s.register(peerID, conn)
	defer s.unregister(peerID)

	conn.SetCloseHandler(func(code int, text string) error {
		log.Printf("Peer %s disconnected (code %d): %s\n", peerID, code, text)
		return nil
	})

	conn.SetReadDeadline(time.Now().Add(50 * time.Second))
	conn.SetPongHandler(func(appData string) error {
		return conn.SetReadDeadline(time.Now().Add(50 * time.Second))
	})

	go s.keepAlive(conn)

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			log.Println("Read error:", err)
			break
		}

		var peerMsg PeerMessage
		if err := json.Unmarshal(msg, &peerMsg); err != nil {
			log.Println("Invalid message format:", err)
			continue
		}

		s.sendToPeer(peerMsg.To, msg)
	}
}

func (s *Server) register(id string, conn *websocket.Conn) {
	s.peersMu.Lock()
	defer s.peersMu.Unlock()
	s.peers[id] = conn
	log.Println("Peer connected:", id)
}

func (s *Server) unregister(id string) {
	s.peersMu.Lock()
	defer s.peersMu.Unlock()
	delete(s.peers, id)
	log.Println("Peer disconnected:", id)
}

func (s *Server) sendToPeer(to string, message []byte) {
	s.peersMu.RLock()
	conn, ok := s.peers[to]
	s.peersMu.RUnlock()

	if !ok {
		log.Printf("Peer %s not found\n", to)
		return
	}

	err := conn.WriteMessage(websocket.TextMessage, message)
	if err != nil {
		log.Printf("Failed to send to %s: %v\n", to, err)
		s.unregister(to)
	}
}

func (s *Server) keepAlive(conn *websocket.Conn) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(time.Second))
		if err != nil {
			return
		}
	}
}
