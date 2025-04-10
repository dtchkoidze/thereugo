package server

import (
	"fmt"
	"log"
	"net/http"
)

func Start(addr string) {
	mux := http.NewServeMux()

	fs := http.FileServer(http.Dir("ui/static"))
	mux.Handle("/", fs)

	mux.HandleFunc("/send", handleSend)

	log.Printf("ThereUGO server running at http://%s\n", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func handleSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Failed to read file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	log.Printf("Received file: %s (%d bytes)\n", header.Filename, header.Size)
	fmt.Fprint(w, "File received (mock)")
}
