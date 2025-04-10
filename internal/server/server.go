package server

import (
	"log"
	"net/http"

	"github.com/dtchkoidze/thereugo/internal/ws"
)

func Start(addr string) {
	ws := ws.NewServer()
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", ws.Handle)

	fs := http.FileServer(http.Dir("ui/static"))
	mux.Handle("/", fs)

	log.Println("ThereUGO server running at", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
