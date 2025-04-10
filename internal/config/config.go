package config

import (
	"fmt"
	"os"

	"github.com/lpernett/godotenv"
)

type Config struct {
	AppPort string
}

func LoadEnv() error {
	return godotenv.Load()
}

func Get() (*Config, error) {
	err := LoadEnv()
	if err != nil {
		return nil, fmt.Errorf("failed to load .env file: %w", err)
	}

	config := &Config{
		AppPort: getEnvWithDefault("APP_PORT", ":8099"),
	}

	return config, nil
}

func getEnvWithDefault(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
