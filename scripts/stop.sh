#!/bin/bash
# Stop all services

set -e

cd "$(dirname "$0")/.."

docker-compose down --remove-orphans
echo "All services stopped."
