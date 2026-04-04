#!/bin/bash
# logs.sh — live stream of all pipeline activity
#
# Tails logs/pipeline.log and colorizes by log level.
# All pipelines (analyze-tiktok, categorize-idea, plan-idea, embed-tiktok)
# write to this file whether run locally or from the orchestrator container.
#
# Usage:
#   ./scripts/logs.sh           # live tail (Ctrl+C to stop)
#   ./scripts/logs.sh --last 50 # show last 50 lines then tail
#   ./scripts/logs.sh --clear   # clear the log file

cd "$(dirname "$0")/.."

LOG_FILE="logs/pipeline.log"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
DIM='\033[2m'
RESET='\033[0m'

if [[ "$1" == "--clear" ]]; then
  > "$LOG_FILE"
  echo "Log file cleared."
  exit 0
fi

if [[ ! -f "$LOG_FILE" ]]; then
  echo "No log file yet at $LOG_FILE"
  echo "Run a pipeline first: cd orchestrator && npx tsx src/index.ts analyze-tiktok --limit 1"
  exit 1
fi

LINES=0
if [[ "$1" == "--last" && -n "$2" ]]; then
  LINES=$2
fi

echo -e "${BOLD}Pipeline log — $(realpath $LOG_FILE)${RESET}"
echo -e "${DIM}Ctrl+C to stop${RESET}\n"

colorize() {
  while IFS= read -r line; do
    ts=$(echo "$line" | cut -c1-24)
    rest=$(echo "$line" | cut -c26-)

    if [[ "$line" == *"[STAGE]"* ]]; then
      echo -e "${DIM}${ts}${RESET} ${CYAN}${BOLD}${rest}${RESET}"
    elif [[ "$line" == *"[OK   ]"* ]]; then
      echo -e "${DIM}${ts}${RESET} ${GREEN}${rest}${RESET}"
    elif [[ "$line" == *"[WARN ]"* ]]; then
      echo -e "${DIM}${ts}${RESET} ${YELLOW}${rest}${RESET}"
    elif [[ "$line" == *"[ERROR]"* ]]; then
      echo -e "${DIM}${ts}${RESET} ${RED}${BOLD}${rest}${RESET}"
    else
      echo -e "${DIM}${ts}${RESET} ${rest}"
    fi
  done
}

if [[ "$LINES" -gt 0 ]]; then
  tail -n "$LINES" -f "$LOG_FILE" | colorize
else
  tail -f "$LOG_FILE" | colorize
fi
