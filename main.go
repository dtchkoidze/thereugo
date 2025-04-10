package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/pion/webrtc/v3"
)

func handleOffer(w http.ResponseWriter, r *http.Request) {
	var offer webrtc.SessionDescription
	if err := json.NewDecoder(r.Body).Decode(&offer); err != nil {
		log.Println("Error decoding offer:", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Create a new peer connection
	peerConnection, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		log.Println("Error creating peer connection:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Set the remote offer
	err = peerConnection.SetRemoteDescription(offer)
	if err != nil {
		log.Println("Error setting remote description:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Create an answer
	answer, err := peerConnection.CreateAnswer(nil)
	if err != nil {
		log.Println("Error creating answer:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Set the local answer
	err = peerConnection.SetLocalDescription(answer)
	if err != nil {
		log.Println("Error setting local description:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Send the answer back to the client
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(answer)
}

func main() {
	http.HandleFunc("/offer", handleOffer)

	// Serve the web UI
	http.Handle("/", http.FileServer(http.Dir("ui/static")))

	// Start the server
	port := ":8099"
	fmt.Printf("Starting server on %s\n", port)
	log.Fatal(http.ListenAndServe(port, nil))
}
