#!/bin/bash
# status.sh — single-command system snapshot
#
# Shows:
#   1. Container health (all services)
#   2. TikTok pipeline queue stats
#   3. Last 5 completed/failed analyses
#   4. Qdrant vector count
#
# Usage: ./scripts/status.sh

cd "$(dirname "$0")/.."

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║              AI-Agent-System Status                  ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""

# ── 1. Container Health ───────────────────────────────────────────────────────
echo -e "${BOLD}CONTAINERS${RESET}"

services=("orchestrator-mysql" "mcp-notion-idea-server-http" "orchestrator" "ollama" "whisper" "qdrant" "portainer")

for name in "${services[@]}"; do
  status=$(docker ps --filter "name=^${name}$" --format "{{.Status}}" 2>/dev/null)
  if [[ -z "$status" ]]; then
    echo -e "  ${RED}✗${RESET} ${name}  ${RED}not running${RESET}"
  elif [[ "$status" == *"healthy"* ]]; then
    echo -e "  ${GREEN}✓${RESET} ${name}  ${GREEN}${status}${RESET}"
  elif [[ "$status" == *"Up"* ]]; then
    echo -e "  ${GREEN}✓${RESET} ${name}  ${status}"
  else
    echo -e "  ${YELLOW}⚠${RESET} ${name}  ${YELLOW}${status}${RESET}"
  fi
done
echo ""

# ── 2. TikTok Queue Stats ─────────────────────────────────────────────────────
echo -e "${BOLD}TIKTOK PIPELINE${RESET}"

MYSQL_CMD="docker exec orchestrator-mysql mysql -u orchestrator -porchestrator tiktok -sN -e"

stats=$($MYSQL_CMD "
  SELECT
    SUM(v.queued_for_analysis = 1 AND (a.analysis_status IS NULL OR a.analysis_status != 'done')) AS queued,
    SUM(v.queued_for_analysis = 1 AND a.analysis_status = 'done')                                 AS done,
    SUM(a.summary LIKE 'ERROR:%')                                                                  AS failed,
    COUNT(*)                                                                                        AS total,
    SUM(v.has_local_file = 1)                                                                      AS with_file
  FROM tiktok_videos v
  LEFT JOIN tiktok_analysis a ON a.video_id = v.video_id
" 2>/dev/null)

if [[ -n "$stats" ]]; then
  queued=$(echo "$stats" | awk '{print $1}')
  done=$(echo "$stats"   | awk '{print $2}')
  failed=$(echo "$stats" | awk '{print $3}')
  total=$(echo "$stats"  | awk '{print $4}')
  files=$(echo "$stats"  | awk '{print $5}')

  echo -e "  Total videos in library:  ${BOLD}${total}${RESET}"
  echo -e "  Videos with local MP4:    ${files}"
  echo -e "  Analyzed (done):          ${GREEN}${done}${RESET}"
  echo -e "  Queued (pending):         ${CYAN}${queued}${RESET}"
  [[ "$failed" -gt 0 ]] && echo -e "  Failed:                   ${RED}${failed}${RESET}"
else
  echo -e "  ${YELLOW}⚠ Could not reach MySQL${RESET}"
fi
echo ""

# ── 3. Recent Analyses ────────────────────────────────────────────────────────
echo -e "${BOLD}RECENT ANALYSES (last 5)${RESET}"

recent=$($MYSQL_CMD "
  SELECT a.video_id, a.analysis_status, a.content_type,
         LEFT(a.summary, 60) AS summary_preview,
         a.updated_at
  FROM tiktok_analysis a
  ORDER BY a.updated_at DESC
  LIMIT 5
" 2>/dev/null)

if [[ -n "$recent" ]]; then
  while IFS=$'\t' read -r vid status ctype preview updated; do
    if [[ "$status" == "done" ]]; then
      icon="${GREEN}✓${RESET}"
    else
      icon="${YELLOW}…${RESET}"
    fi
    echo -e "  ${icon} [${ctype:-?}] ${vid}  ${RESET}${preview}…"
    echo -e "      ${RESET}${updated}"
  done <<< "$recent"
else
  echo -e "  ${YELLOW}No analyses yet${RESET}"
fi
echo ""

# ── 4. Qdrant Vector Count ────────────────────────────────────────────────────
echo -e "${BOLD}QDRANT (vector store)${RESET}"

qdrant_resp=$(curl -s http://localhost:6333/collections/knowledge 2>/dev/null)
if [[ -n "$qdrant_resp" ]]; then
  count=$(echo "$qdrant_resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['points_count'])" 2>/dev/null)
  if [[ -n "$count" ]]; then
    echo -e "  Vectors in knowledge collection: ${BOLD}${count}${RESET}"
  else
    echo -e "  Collection not yet created (run embed-tiktok first)"
  fi
else
  echo -e "  ${YELLOW}⚠ Qdrant not reachable${RESET}"
fi
echo ""

# ── 5. Quick reference ────────────────────────────────────────────────────────
echo -e "${BOLD}USEFUL COMMANDS${RESET}"
echo -e "  ${CYAN}Portainer UI:${RESET}       http://localhost:9001  (container logs)"
echo -e "  ${CYAN}Tail a container:${RESET}   docker logs -f <name>"
echo -e "  ${CYAN}Queue videos:${RESET}       cd orchestrator && npx tsx src/index.ts queue-tiktok --file ../scripts/tiktok/queues/ai-videos.txt"
echo -e "  ${CYAN}Analyze batch:${RESET}      cd orchestrator && npx tsx src/index.ts analyze-tiktok --limit 10"
echo -e "  ${CYAN}Embed to Qdrant:${RESET}    cd orchestrator && npx tsx src/index.ts embed-tiktok"
echo ""
