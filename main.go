package main

import (
	"log"

	"github.com/dtchkoidze/thereugo/internal/config"
	"github.com/dtchkoidze/thereugo/internal/server"
)

func main() {

	conf, err := config.Get()
	if err != nil {
		log.Println(err)
	}

	server.Start(conf.AppPort)
}
