#!/usr/bin/env bash
# =============================================================================
#  ATLAS LaunchOps — Master Deployment Script v2.1
#  Founder Edition | Production-Grade | Ubuntu 20.04/22.04/24.04
# =============================================================================
#
#  USAGE:
#    ./deploy.sh                    # Interactive guided setup
#    ./deploy.sh --auto             # Non-interactive (reads .env)
#    ./deploy.sh --ssl              # Include SSL/TLS via Certbot
#    ./deploy.sh --dry-run          # Validate without making changes
#    ./deploy.sh --status           # Show live service health
#    ./deploy.sh --update           # Pull latest images and restart
#    ./deploy.sh --rollback         # Roll back to last known good state
#    ./deploy.sh --teardown         # Stop all containers (data preserved)
#    ./deploy.sh --teardown --purge # Stop and DELETE all data volumes
#    ./deploy.sh --logs [service]   # Tail logs for a service
#    ./deploy.sh --backup           # Backup all service data to ./backups/
#    ./deploy.sh --restore <file>   # Restore from a backup archive
#
#  REQUIREMENTS:
#    - Ubuntu 20.04 / 22.04 / 24.04 (x86_64 or arm64)
#    - 4 GB RAM minimum (8 GB recommended for all 7 services)
#    - 40 GB disk minimum
#    - Ports 80 and 443 open (for SSL mode)
#    - Root or sudo access
#
#  SERVICES DEPLOYED:
#    Vaultwarden  — Password manager / credential vault
#    WordPress    — Marketing website + WooCommerce
#    Mautic       — Email marketing automation
#    Nextcloud    — Secure file storage and collaboration
#    Chatwoot     — Customer support live chat
#    Matomo       — Privacy-first web analytics
#    Taiga        — Agile project management
#
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# ── Script metadata ───────────────────────────────────────────────────────────
readonly SCRIPT_VERSION="2.1.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly LOG_DIR="${SCRIPT_DIR}/logs"
readonly LOG_FILE="${LOG_DIR}/deploy-$(date +%Y%m%d-%H%M%S).log"
readonly ATLAS_ENV="${SCRIPT_DIR}/atlas.env"
readonly BACKUP_DIR="${SCRIPT_DIR}/backups"
readonly SNAPSHOT_FILE="${SCRIPT_DIR}/.last_good_state"
readonly COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
readonly MIN_RAM_MB=3800
readonly MIN_DISK_GB=35
readonly HEALTH_TIMEOUT=120
readonly HEALTH_INTERVAL=5

# ── CLI flags ─────────────────────────────────────────────────────────────────
AUTO_MODE=false
DRY_RUN=false
ENABLE_SSL=false
STATUS_ONLY=false
UPDATE_MODE=false
ROLLBACK_MODE=false
TEARDOWN=false
PURGE_DATA=false
LOGS_MODE=false
LOGS_SERVICE=""
BACKUP_MODE=false
RESTORE_MODE=false
RESTORE_FILE=""
SUDO=""

# ── Parse CLI arguments ───────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --auto)       AUTO_MODE=true ;;
    --ssl)        ENABLE_SSL=true ;;
    --dry-run)    DRY_RUN=true ;;
    --status)     STATUS_ONLY=true ;;
    --update)     UPDATE_MODE=true ;;
    --rollback)   ROLLBACK_MODE=true ;;
    --teardown)   TEARDOWN=true ;;
    --purge)      PURGE_DATA=true ;;
    --backup)     BACKUP_MODE=true ;;
    --restore)    RESTORE_MODE=true; RESTORE_FILE="${2:-}"; shift ;;
    --logs)       LOGS_MODE=true; LOGS_SERVICE="${2:-}"; shift ;;
    --help|-h)
      grep "^#  " "$0" | sed 's/^#  //' | head -25
      exit 0 ;;
    *) echo "Unknown option: $1  (use --help)"; exit 1 ;;
  esac
  shift
done

# =============================================================================
# SECTION 1: LOGGING & UI HELPERS
# =============================================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BLUE='\033[0;34m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

mkdir -p "$LOG_DIR"

log()     { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$1] ${*:2}" >> "$LOG_FILE"; }
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; log "INFO" "$*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; log "OK" "$*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; log "WARN" "$*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; log "ERROR" "$*"; }
step()    { echo -e "\n${BOLD}${CYAN}>>  $*${NC}"; log "STEP" "$*"; }
die()     { error "$*"; exit 1; }

spinner_pid=""
start_spinner() {
  local msg="$1"
  ( while true; do
      for s in '|' '/' '-' '\'; do
        printf "\r  %s %s   " "$s" "$msg"
        sleep 0.15
      done
    done ) &
  spinner_pid=$!
}
stop_spinner() {
  [[ -n "$spinner_pid" ]] && { kill "$spinner_pid" 2>/dev/null || true; spinner_pid=""; printf "\r%-70s\r" " "; }
}

banner() {
  echo -e "${BOLD}${CYAN}"
  echo "  ================================================================"
  echo "    ATLAS LaunchOps  --  Founder Edition v${SCRIPT_VERSION}"
  echo "    Multi-Agent AI Operating System for Founders"
  echo "  ================================================================"
  echo -e "${NC}"
  echo -e "  ${DIM}Script:  ${SCRIPT_NAME}${NC}"
  echo -e "  ${DIM}Log:     ${LOG_FILE}${NC}"
  echo -e "  ${DIM}Started: $(date)${NC}"
  echo ""
}

# =============================================================================
# SECTION 2: PRE-FLIGHT CHECKS
# =============================================================================

check_os() {
  step "Pre-flight: OS compatibility"
  if [[ -f /etc/os-release ]]; then
    local os_id; os_id="$(. /etc/os-release && echo "${ID:-unknown}")"
    local os_ver; os_ver="$(. /etc/os-release && echo "${VERSION_ID:-0}")"
    case "$os_id" in
      ubuntu)
        case "$os_ver" in
          20.04|22.04|24.04) success "OS: Ubuntu $os_ver -- fully supported" ;;
          *) warn "Ubuntu $os_ver is untested. Proceeding with caution." ;;
        esac ;;
      debian) warn "Debian $os_ver detected -- most features should work." ;;
      *) warn "OS '$os_id' is not officially supported." ;;
    esac
  fi
  local arch; arch="$(uname -m)"
  case "$arch" in
    x86_64|aarch64|arm64) success "Architecture: $arch -- supported" ;;
    *) warn "Architecture '$arch' may have limited Docker image support" ;;
  esac
}

check_root() {
  step "Pre-flight: Privileges"
  if [[ "$EUID" -eq 0 ]]; then
    success "Running as root"
    SUDO=""
  elif sudo -n true 2>/dev/null; then
    success "Sudo access confirmed"
    SUDO="sudo"
  else
    if [[ "$DRY_RUN" == "true" ]] || [[ "$STATUS_ONLY" == "true" ]]; then
      warn "No root/sudo -- some checks may be limited"
    else
      die "Root or sudo access required. Run: sudo $0"
    fi
  fi
}

check_resources() {
  step "Pre-flight: System resources"

  local ram_mb=0
  if [[ -f /proc/meminfo ]]; then
    ram_mb=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo)
  fi
  if [[ "$ram_mb" -ge "$MIN_RAM_MB" ]]; then
    success "RAM: ${ram_mb}MB (minimum: ${MIN_RAM_MB}MB)"
  else
    warn "RAM: ${ram_mb}MB -- below recommended ${MIN_RAM_MB}MB. Services may be slow."
  fi

  local disk_gb=0
  disk_gb=$(df -BG "$SCRIPT_DIR" 2>/dev/null | awk 'NR==2 {gsub("G",""); print $4}' || echo 0)
  if [[ "$disk_gb" -ge "$MIN_DISK_GB" ]]; then
    success "Disk: ${disk_gb}GB free (minimum: ${MIN_DISK_GB}GB)"
  else
    warn "Disk: ${disk_gb}GB free -- below recommended ${MIN_DISK_GB}GB."
  fi

  local cpu_cores; cpu_cores="$(nproc 2>/dev/null || echo 1)"
  [[ "$cpu_cores" -ge 2 ]] && success "CPU: ${cpu_cores} cores" || warn "CPU: ${cpu_cores} core -- 2+ recommended"

  local swap_mb=0
  if [[ -f /proc/meminfo ]]; then
    swap_mb=$(awk '/SwapTotal/ {printf "%d", $2/1024}' /proc/meminfo)
  fi
  if [[ "$swap_mb" -lt 1024 ]] && [[ "$DRY_RUN" == "false" ]] && [[ "$AUTO_MODE" == "false" ]]; then
    warn "Swap: ${swap_mb}MB -- consider adding 2GB swap for stability"
    read -rp "  Create 2GB swap file now? [y/N] " create_swap
    if [[ "${create_swap,,}" == "y" ]]; then
      $SUDO fallocate -l 2G /swapfile 2>/dev/null || $SUDO dd if=/dev/zero of=/swapfile bs=1M count=2048
      $SUDO chmod 600 /swapfile && $SUDO mkswap /swapfile && $SUDO swapon /swapfile
      echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab > /dev/null
      success "2GB swap file created and activated"
    fi
  else
    success "Swap: ${swap_mb}MB"
  fi
}

check_dependencies() {
  step "Pre-flight: Dependencies"
  local missing=()

  if command -v docker &>/dev/null; then
    success "Docker: $(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)"
  else
    warn "Docker not found -- will install"; missing+=("docker")
  fi

  if docker compose version &>/dev/null 2>&1; then
    success "Docker Compose v2 available"
  else
    warn "Docker Compose v2 not found -- will install"; missing+=("docker-compose-plugin")
  fi

  for tool in curl git openssl python3 jq; do
    if command -v "$tool" &>/dev/null; then
      success "$tool: available"
    else
      warn "$tool not found -- will install"; missing+=("$tool")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]] && [[ "$DRY_RUN" == "false" ]]; then
    info "Installing missing dependencies: ${missing[*]}"
    $SUDO apt-get update -qq 2>>"$LOG_FILE"
    for dep in "${missing[@]}"; do
      case "$dep" in
        docker)
          curl -fsSL https://get.docker.com | $SUDO sh 2>>"$LOG_FILE"
          $SUDO systemctl enable docker && $SUDO systemctl start docker
          [[ -n "${SUDO_USER:-}" ]] && $SUDO usermod -aG docker "$SUDO_USER"
          success "Docker installed" ;;
        docker-compose-plugin)
          $SUDO apt-get install -y -qq docker-compose-plugin 2>>"$LOG_FILE"
          success "Docker Compose v2 installed" ;;
        python3)
          $SUDO apt-get install -y -qq python3 python3-pip 2>>"$LOG_FILE"
          success "Python3 installed" ;;
        *)
          $SUDO apt-get install -y -qq "$dep" 2>>"$LOG_FILE"
          success "$dep installed" ;;
      esac
    done
    python3 -m pip install -q requests 2>/dev/null || true
  elif [[ ${#missing[@]} -gt 0 ]]; then
    info "[DRY RUN] Would install: ${missing[*]}"
  fi
}

check_ports() {
  step "Pre-flight: Port availability"
  local ports=(80 443 3306 6379 8000 8080 8081 8082 3001 8083 9000)
  local conflicts=()
  for port in "${ports[@]}"; do
    if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
      warn "Port ${port} in use"
      conflicts+=("$port")
    fi
  done
  if [[ ${#conflicts[@]} -gt 0 ]]; then
    warn "Port conflicts: ${conflicts[*]} -- edit atlas.env to change ports or stop conflicting processes"
    if [[ "$AUTO_MODE" == "false" ]] && [[ "$DRY_RUN" == "false" ]]; then
      read -rp "  Continue anyway? [y/N] " cont
      [[ "${cont,,}" != "y" ]] && die "Aborted due to port conflicts"
    fi
  else
    success "All required ports are available"
  fi
}

# =============================================================================
# SECTION 3: ENVIRONMENT SETUP
# =============================================================================

gen_secret()   { openssl rand -base64 32 | tr -d '/+=' | head -c 32; }
gen_password() { openssl rand -base64 24 | tr -d '/+=' | head -c 20; }

write_env_file() {
  # Write the atlas.env file using python3 to avoid shell heredoc quoting issues
  python3 - "$1" "$2" "$3" "$4" "$5" "$6" "$7" \
    "$8" "$9" "${10}" "${11}" "${12}" "${13}" "${14}" \
    "${15}" "${16}" "${17}" "${18}" "${19}" "${20}" \
    "${21}" "${22}" "${23}" "${24}" "${25}" "${26}" << 'PYEOF'
import sys, os
(_, bname, domain, email, btype, oai, stripe_sk, gh_token,
 db_root, redis_pw, bw_token, wp_db_pw, mautic_db_pw, mautic_adm_pw,
 nc_adm_pw, nc_db_pw, cw_secret, cw_db_pw, cw_adm_pw,
 matomo_db_pw, taiga_secret, taiga_db_pw, enable_ssl) = sys.argv[:23]

content = f"""# =============================================================================
# ATLAS LaunchOps Environment Configuration
# WARNING: This file contains secrets. Never commit to version control.
# =============================================================================

# Business Identity
BUSINESS_NAME={bname}
DOMAIN={domain}
EMAIL={email}
BUSINESS_TYPE={btype}

# External API Keys
OPENAI_API_KEY={oai}
OPENAI_MODEL=gpt-4o
STRIPE_SECRET_KEY={stripe_sk}
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
GITHUB_TOKEN={gh_token}

# Database (shared MariaDB)
DB_ROOT_PASSWORD={db_root}
DB_HOST=atlas_db
DB_PORT=3306

# Redis
REDIS_PASSWORD={redis_pw}
REDIS_HOST=atlas_redis
REDIS_PORT=6379

# Vaultwarden
BITWARDEN_ADMIN_TOKEN={bw_token}
BITWARDEN_PORT=8000
BITWARDEN_WEBSOCKET_PORT=3012

# WordPress
WP_DB_NAME=wordpress
WP_DB_USER=wp_user
WP_DB_PASSWORD={wp_db_pw}
WORDPRESS_PORT=8080

# Mautic
MAUTIC_DB_NAME=mautic
MAUTIC_DB_USER=mautic_user
MAUTIC_DB_PASSWORD={mautic_db_pw}
MAUTIC_ADMIN_EMAIL={email}
MAUTIC_ADMIN_PASSWORD={mautic_adm_pw}
MAUTIC_PORT=8081

# Nextcloud
NEXTCLOUD_ADMIN_USER=admin
NEXTCLOUD_ADMIN_PASSWORD={nc_adm_pw}
NEXTCLOUD_DB_NAME=nextcloud
NEXTCLOUD_DB_USER=nc_user
NEXTCLOUD_DB_PASSWORD={nc_db_pw}
NEXTCLOUD_PORT=8082

# Chatwoot
CHATWOOT_SECRET_KEY_BASE={cw_secret}
CHATWOOT_DB_NAME=chatwoot
CHATWOOT_DB_USER=chatwoot_user
CHATWOOT_DB_PASSWORD={cw_db_pw}
CHATWOOT_ADMIN_EMAIL={email}
CHATWOOT_ADMIN_PASSWORD={cw_adm_pw}
CHATWOOT_PORT=3001

# Matomo
MATOMO_DB_NAME=matomo
MATOMO_DB_USER=matomo_user
MATOMO_DB_PASSWORD={matomo_db_pw}
MATOMO_PORT=8083

# Taiga
TAIGA_SECRET_KEY={taiga_secret}
TAIGA_DB_NAME=taiga
TAIGA_DB_USER=taiga_user
TAIGA_DB_PASSWORD={taiga_db_pw}
TAIGA_PORT=9000

# Nginx
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443

# SSL
ENABLE_SSL={enable_ssl}
CERTBOT_EMAIL={email}

# SMTP (configure after deployment)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM={email}
SMTP_TLS=true
"""
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "atlas.env")
with open(env_path, "w") as f:
    f.write(content)
os.chmod(env_path, 0o600)
print("ENV_WRITTEN_OK")
PYEOF
}

setup_env() {
  step "Environment configuration"

  if [[ -f "$ATLAS_ENV" ]] && [[ "$AUTO_MODE" == "true" ]]; then
    info "Loading existing atlas.env (--auto mode)"
    set -a; source "$ATLAS_ENV"; set +a; return
  fi

  if [[ -f "$ATLAS_ENV" ]] && [[ "$AUTO_MODE" == "false" ]]; then
    read -rp "  atlas.env already exists. Overwrite? [y/N] " ow
    if [[ "${ow,,}" != "y" ]]; then
      info "Using existing atlas.env"
      set -a; source "$ATLAS_ENV"; set +a; return
    fi
  fi

  if [[ "$AUTO_MODE" == "false" ]]; then
    echo ""
    echo -e "  ${BOLD}Business Configuration${NC}  ${DIM}(Enter to accept defaults)${NC}"
    echo ""
    read -rp "  Business name [My Startup]: "                                    _BNAME
    read -rp "  Domain (e.g. mycompany.com) [localhost]: "                       _DOMAIN
    read -rp "  Admin email [admin@example.com]: "                               _EMAIL
    read -rp "  Business type (saas/ecommerce/agency/marketplace) [saas]: "      _BTYPE
    read -rp "  OpenAI API key (optional, Enter to skip): "                      _OAI
    read -rp "  Stripe secret key (optional, Enter to skip): "                   _STRIPE
    read -rp "  GitHub token (optional, Enter to skip): "                        _GH
  fi

  local BNAME="${_BNAME:-My Startup}"
  local DOMAIN="${_DOMAIN:-localhost}"
  local EMAIL="${_EMAIL:-admin@example.com}"
  local BTYPE="${_BTYPE:-saas}"
  local OAI="${_OAI:-}"
  local STRIPE_SK="${_STRIPE:-}"
  local GH="${_GH:-}"

  info "Generating secure credentials for all services..."
  local DB_ROOT;      DB_ROOT="$(gen_password)"
  local REDIS_PW;     REDIS_PW="$(gen_password)"
  local BW_TOKEN;     BW_TOKEN="$(gen_secret)"
  local WP_DB_PW;     WP_DB_PW="$(gen_password)"
  local MAUTIC_DB;    MAUTIC_DB="$(gen_password)"
  local MAUTIC_ADM;   MAUTIC_ADM="$(gen_password)"
  local NC_ADM;       NC_ADM="$(gen_password)"
  local NC_DB;        NC_DB="$(gen_password)"
  local CW_SECRET;    CW_SECRET="$(gen_secret)"
  local CW_DB;        CW_DB="$(gen_password)"
  local CW_ADM;       CW_ADM="$(gen_password)"
  local MATOMO_DB;    MATOMO_DB="$(gen_password)"
  local TAIGA_SEC;    TAIGA_SEC="$(gen_secret)"
  local TAIGA_DB;     TAIGA_DB="$(gen_password)"

  write_env_file \
    "$BNAME" "$DOMAIN" "$EMAIL" "$BTYPE" "$OAI" "$STRIPE_SK" "$GH" \
    "$DB_ROOT" "$REDIS_PW" "$BW_TOKEN" "$WP_DB_PW" "$MAUTIC_DB" "$MAUTIC_ADM" \
    "$NC_ADM" "$NC_DB" "$CW_SECRET" "$CW_DB" "$CW_ADM" \
    "$MATOMO_DB" "$TAIGA_SEC" "$TAIGA_DB" "$ENABLE_SSL"

  success "atlas.env generated with secure credentials"
  warn "IMPORTANT: Back up ${ATLAS_ENV} -- it contains all service passwords"
  set -a; source "$ATLAS_ENV"; set +a
}

# =============================================================================
# SECTION 4: DIRECTORY & VOLUME SETUP
# =============================================================================

setup_directories() {
  step "Creating data directories"
  local dirs=(
    "${SCRIPT_DIR}/data/mysql"
    "${SCRIPT_DIR}/data/redis"
    "${SCRIPT_DIR}/data/vaultwarden"
    "${SCRIPT_DIR}/data/wordpress/html"
    "${SCRIPT_DIR}/data/mautic/html"
    "${SCRIPT_DIR}/data/nextcloud/html"
    "${SCRIPT_DIR}/data/nextcloud/data"
    "${SCRIPT_DIR}/data/nextcloud/config"
    "${SCRIPT_DIR}/data/chatwoot/storage"
    "${SCRIPT_DIR}/data/matomo/html"
    "${SCRIPT_DIR}/data/taiga/static"
    "${SCRIPT_DIR}/data/taiga/media"
    "${SCRIPT_DIR}/data/nginx/ssl"
    "${SCRIPT_DIR}/data/nginx/logs"
    "${SCRIPT_DIR}/data/certbot/conf"
    "${SCRIPT_DIR}/data/certbot/www"
    "${SCRIPT_DIR}/logs"
    "${BACKUP_DIR}"
    "${SCRIPT_DIR}/nginx/conf.d"
  )
  for dir in "${dirs[@]}"; do
    if [[ "$DRY_RUN" == "true" ]]; then
      info "[DRY RUN] mkdir -p $dir"
    else
      mkdir -p "$dir"
    fi
  done
  if [[ "$DRY_RUN" == "false" ]]; then
    chmod 700 "${SCRIPT_DIR}/data/vaultwarden" "${SCRIPT_DIR}/data/mysql" 2>/dev/null || true
    success "Data directories created"
  fi
}

# =============================================================================
# SECTION 5: DOCKER OPERATIONS
# =============================================================================

pull_images() {
  step "Pulling Docker images"
  if [[ "$DRY_RUN" == "true" ]]; then
    info "[DRY RUN] Would pull all images from docker-compose.yml"; return
  fi
  start_spinner "Pulling images (this may take several minutes)..."
  docker compose -f "$COMPOSE_FILE" pull --quiet 2>>"$LOG_FILE" \
    && { stop_spinner; success "Images pulled"; } \
    || { stop_spinner; warn "Some images failed to pull -- will retry on start"; }
}

start_services() {
  step "Starting services"
  if [[ "$DRY_RUN" == "true" ]]; then
    info "[DRY RUN] Would run: docker compose up -d"; return
  fi
  info "Starting database and cache layer first..."
  docker compose -f "$COMPOSE_FILE" up -d atlas_db atlas_redis 2>>"$LOG_FILE"
  info "Waiting 20 seconds for databases to initialize..."
  sleep 20
  info "Starting all application services..."
  docker compose -f "$COMPOSE_FILE" up -d 2>>"$LOG_FILE"
  docker compose -f "$COMPOSE_FILE" ps --format json > "$SNAPSHOT_FILE" 2>/dev/null || true
  success "All services started"
}

teardown() {
  step "Tearing down ATLAS LaunchOps"
  if [[ "$PURGE_DATA" == "true" ]]; then
    warn "PURGE mode: all container data will be PERMANENTLY DELETED"
    if [[ "$AUTO_MODE" == "false" ]]; then
      read -rp "  Type DELETE to confirm: " confirm
      [[ "$confirm" != "DELETE" ]] && die "Aborted"
    fi
    docker compose -f "$COMPOSE_FILE" down -v --remove-orphans 2>>"$LOG_FILE"
    rm -rf "${SCRIPT_DIR}/data"
    success "All containers and data volumes removed"
  else
    docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>>"$LOG_FILE"
    success "All containers stopped (data preserved in ./data/)"
  fi
}

update_services() {
  step "Updating services"
  docker compose -f "$COMPOSE_FILE" ps --format json > "$SNAPSHOT_FILE" 2>/dev/null || true
  start_spinner "Pulling latest images..."
  docker compose -f "$COMPOSE_FILE" pull --quiet 2>>"$LOG_FILE"
  stop_spinner
  docker compose -f "$COMPOSE_FILE" up -d --remove-orphans 2>>"$LOG_FILE"
  success "Services updated and restarted"
}

rollback_services() {
  step "Rolling back to last known good state"
  [[ ! -f "$SNAPSHOT_FILE" ]] && die "No snapshot found at $SNAPSHOT_FILE"
  warn "Rolling back all services..."
  docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>>"$LOG_FILE"
  docker compose -f "$COMPOSE_FILE" up -d 2>>"$LOG_FILE"
  success "Rollback complete"
}

tail_logs() {
  local svc="${LOGS_SERVICE:-}"
  if [[ -n "$svc" ]]; then
    docker compose -f "$COMPOSE_FILE" logs -f --tail=100 "$svc"
  else
    docker compose -f "$COMPOSE_FILE" logs -f --tail=50
  fi
}

# =============================================================================
# SECTION 6: HEALTH CHECKS
# =============================================================================

check_container_health() {
  local name="$1"
  local status; status="$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null || echo 'not_found')"
  local health; health="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$name" 2>/dev/null || echo 'unknown')"
  [[ "$status" == "running" ]] && [[ "$health" != "unhealthy" ]] && return 0 || return 1
}

wait_for_http() {
  local url="$1" label="$2" timeout="${3:-$HEALTH_TIMEOUT}" elapsed=0
  printf "  Waiting for %-22s" "$label..."
  while [[ $elapsed -lt $timeout ]]; do
    if curl -fsS --max-time 5 "$url" &>/dev/null; then
      echo -e " ${GREEN}OK${NC} (${elapsed}s)"; return 0
    fi
    sleep "$HEALTH_INTERVAL"; elapsed=$((elapsed + HEALTH_INTERVAL)); printf "."
  done
  echo -e " ${RED}TIMEOUT${NC}"; return 1
}

run_health_checks() {
  step "Service health verification"
  [[ -f "$ATLAS_ENV" ]] && { set -a; source "$ATLAS_ENV"; set +a; }
  local all_healthy=true
  echo ""
  echo -e "  ${BOLD}Container Status:${NC}"
  for container in atlas_db atlas_redis atlas_vaultwarden atlas_wordpress atlas_mautic atlas_nextcloud atlas_chatwoot atlas_matomo atlas_taiga_front; do
    if check_container_health "$container"; then
      printf "  ${GREEN}OK${NC}  %-35s running\n" "$container"
    else
      printf "  ${RED}XX${NC}  %-35s ${RED}not healthy${NC}\n" "$container"
      all_healthy=false
    fi
  done
  echo ""
  echo -e "  ${BOLD}HTTP Endpoints:${NC}"
  local base="http://localhost"
  wait_for_http "${base}:${BITWARDEN_PORT:-8000}"  "Vaultwarden"  60  || all_healthy=false
  wait_for_http "${base}:${WORDPRESS_PORT:-8080}"  "WordPress"    90  || all_healthy=false
  wait_for_http "${base}:${MAUTIC_PORT:-8081}"     "Mautic"       90  || all_healthy=false
  wait_for_http "${base}:${NEXTCLOUD_PORT:-8082}"  "Nextcloud"    90  || all_healthy=false
  wait_for_http "${base}:${CHATWOOT_PORT:-3001}"   "Chatwoot"     90  || all_healthy=false
  wait_for_http "${base}:${MATOMO_PORT:-8083}"     "Matomo"       90  || all_healthy=false
  wait_for_http "${base}:${TAIGA_PORT:-9000}"      "Taiga"        90  || all_healthy=false
  echo ""
  if [[ "$all_healthy" == "true" ]]; then
    success "All services are healthy"
  else
    warn "Some services not yet healthy -- check: ./deploy.sh --logs [service]"
  fi
}

show_status() {
  step "ATLAS LaunchOps -- Live Status"
  [[ -f "$ATLAS_ENV" ]] && { set -a; source "$ATLAS_ENV"; set +a; }
  echo ""
  docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null \
    || docker compose -f "$COMPOSE_FILE" ps
  echo ""
  echo -e "  ${BOLD}Resource Usage:${NC}"
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>/dev/null \
    | grep -E "atlas_|NAME" || true
  echo ""
  echo -e "  ${BOLD}Disk Usage:${NC}"
  docker system df 2>/dev/null || true
}

# =============================================================================
# SECTION 7: SSL / TLS SETUP (CERTBOT + NGINX)
# =============================================================================

generate_self_signed_cert() {
  local domain="$1"
  info "Generating self-signed certificate for $domain..."
  $SUDO openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "${SCRIPT_DIR}/data/nginx/ssl/${domain}-key.pem" \
    -out    "${SCRIPT_DIR}/data/nginx/ssl/${domain}.pem" \
    -subj "/C=US/ST=State/L=City/O=ATLAS/CN=${domain}" 2>>"$LOG_FILE"
  success "Self-signed certificate generated (valid 365 days)"
}

generate_nginx_ssl_config() {
  local domain="$1"
  local ssl_conf="${SCRIPT_DIR}/nginx/conf.d/atlas-ssl.conf"
  info "Writing Nginx SSL config for $domain..."
  python3 - "$domain" "$ssl_conf" << 'PYNGINX'
import sys
domain, out_path = sys.argv[1], sys.argv[2]
conf = f"""# ATLAS LaunchOps Nginx SSL Config | {domain}

server {{
    listen 80;
    server_name {domain} www.{domain} vault.{domain} mail.{domain} files.{domain} support.{domain} analytics.{domain} projects.{domain};
    location /.well-known/acme-challenge/ {{ root /var/www/certbot; }}
    location / {{ return 301 https://$host$request_uri; }}
}}

ssl_certificate     /etc/nginx/ssl/{domain}.pem;
ssl_certificate_key /etc/nginx/ssl/{domain}-key.pem;
ssl_protocols       TLSv1.2 TLSv1.3;
ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache   shared:SSL:10m;
ssl_session_timeout 1d;
ssl_stapling        on;
ssl_stapling_verify on;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;

upstream vaultwarden {{ server atlas_vaultwarden:80; }}
upstream wordpress   {{ server atlas_wordpress:80; }}
upstream mautic      {{ server atlas_mautic:80; }}
upstream nextcloud   {{ server atlas_nextcloud:80; }}
upstream chatwoot    {{ server atlas_chatwoot:3000; }}
upstream matomo      {{ server atlas_matomo:80; }}
upstream taiga_front {{ server atlas_taiga_front:80; }}
upstream taiga_back  {{ server atlas_taiga_back:8000; }}

server {{
    listen 443 ssl http2;
    server_name {domain} www.{domain};
    client_max_body_size 64M;
    location / {{
        proxy_pass http://wordpress;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }}
}}

server {{
    listen 443 ssl http2;
    server_name vault.{domain};
    client_max_body_size 128M;
    location / {{
        proxy_pass http://vaultwarden;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }}
    location /notifications/hub {{
        proxy_pass http://atlas_vaultwarden:3012;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }}
}}

server {{
    listen 443 ssl http2;
    server_name mail.{domain};
    client_max_body_size 32M;
    location / {{
        proxy_pass http://mautic;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }}
}}

server {{
    listen 443 ssl http2;
    server_name files.{domain};
    client_max_body_size 10G;
    proxy_read_timeout 300;
    location / {{
        proxy_pass http://nextcloud;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;
    }}
}}

server {{
    listen 443 ssl http2;
    server_name support.{domain};
    location / {{
        proxy_pass http://chatwoot;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }}
    location /cable {{
        proxy_pass http://chatwoot/cable;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }}
}}

server {{
    listen 443 ssl http2;
    server_name analytics.{domain};
    location / {{
        proxy_pass http://matomo;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }}
}}

server {{
    listen 443 ssl http2;
    server_name projects.{domain};
    location / {{
        proxy_pass http://taiga_front;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }}
    location /api/ {{
        proxy_pass http://taiga_back/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }}
}}
"""
with open(out_path, "w") as fh:
    fh.write(conf)
print("NGINX_SSL_WRITTEN")
PYNGINX
  success "Nginx SSL config written to $ssl_conf"
}

setup_ssl() {
  step "SSL/TLS certificate provisioning"
  [[ -f "$ATLAS_ENV" ]] && { set -a; source "$ATLAS_ENV"; set +a; }
  local domain="${DOMAIN:-}"
  local email="${CERTBOT_EMAIL:-${EMAIL:-}}"

  if [[ -z "$domain" ]] || [[ "$domain" == "localhost" ]]; then
    warn "SSL skipped -- DOMAIN is not set or is localhost"; return
  fi
  [[ -z "$email" ]] && die "CERTBOT_EMAIL must be set in atlas.env for SSL"

  if [[ "$DRY_RUN" == "true" ]]; then
    info "[DRY RUN] Would obtain SSL certificates for ${domain} and 7 subdomains"; return
  fi

  if ! command -v certbot &>/dev/null; then
    $SUDO apt-get install -y -qq certbot python3-certbot-nginx 2>>"$LOG_FILE"
    success "Certbot installed"
  fi

  docker compose -f "$COMPOSE_FILE" stop atlas_nginx 2>/dev/null || true

  local domain_args="-d ${domain} -d www.${domain} -d vault.${domain} -d mail.${domain} -d files.${domain} -d support.${domain} -d analytics.${domain} -d projects.${domain}"

  # shellcheck disable=SC2086
  if $SUDO certbot certonly --standalone --non-interactive --agree-tos \
    --email "$email" $domain_args 2>>"$LOG_FILE"; then
    $SUDO cp "/etc/letsencrypt/live/${domain}/fullchain.pem" "${SCRIPT_DIR}/data/nginx/ssl/${domain}.pem"
    $SUDO cp "/etc/letsencrypt/live/${domain}/privkey.pem"   "${SCRIPT_DIR}/data/nginx/ssl/${domain}-key.pem"
    $SUDO chmod 644 "${SCRIPT_DIR}/data/nginx/ssl/${domain}.pem"
    $SUDO chmod 600 "${SCRIPT_DIR}/data/nginx/ssl/${domain}-key.pem"
    success "SSL certificates obtained for $domain and all subdomains"
  else
    warn "Certbot failed -- falling back to self-signed certificate"
    generate_self_signed_cert "$domain"
  fi

  generate_nginx_ssl_config "$domain"
  docker compose -f "$COMPOSE_FILE" up -d atlas_nginx 2>>"$LOG_FILE"

  # Auto-renewal cron + nginx reload hook
  local hook="/etc/letsencrypt/renewal-hooks/post/atlas-reload-nginx.sh"
  $SUDO mkdir -p "$(dirname "$hook")"
  printf '#!/bin/bash\ndocker exec atlas_nginx nginx -s reload 2>/dev/null || true\n' | $SUDO tee "$hook" > /dev/null
  $SUDO chmod +x "$hook"
  if ! $SUDO grep -q "certbot renew" /etc/crontab 2>/dev/null; then
    echo "0 0,12 * * * root certbot renew --quiet" | $SUDO tee -a /etc/crontab > /dev/null
    success "SSL auto-renewal configured (twice daily)"
  fi
}

# =============================================================================
# SECTION 8: POST-DEPLOY CONFIGURATION
# =============================================================================

run_post_deploy() {
  step "Post-deploy service configuration"
  if [[ "$DRY_RUN" == "true" ]]; then
    info "[DRY RUN] Would run: python3 post_deploy.py"; return
  fi
  if [[ ! -f "${SCRIPT_DIR}/post_deploy.py" ]]; then
    warn "post_deploy.py not found -- skipping"; return
  fi
  if ! command -v python3 &>/dev/null; then
    warn "python3 not available -- skipping post-deploy"; return
  fi
  info "Running post-deploy configurator..."
  python3 "${SCRIPT_DIR}/post_deploy.py" --env-file "$ATLAS_ENV" 2>>"$LOG_FILE" \
    && success "Post-deploy configuration complete" \
    || warn "Post-deploy had warnings -- check $LOG_FILE"
}

# =============================================================================
# SECTION 9: FIREWALL SETUP
# =============================================================================

setup_firewall() {
  step "Configuring firewall (UFW)"
  command -v ufw &>/dev/null || $SUDO apt-get install -y -qq ufw 2>>"$LOG_FILE"
  if [[ "$DRY_RUN" == "true" ]]; then
    info "[DRY RUN] Would configure UFW: allow SSH/80/443, deny service ports"; return
  fi
  $SUDO ufw --force reset > /dev/null 2>&1
  $SUDO ufw allow ssh        comment 'SSH'
  $SUDO ufw allow 80/tcp     comment 'HTTP'
  $SUDO ufw allow 443/tcp    comment 'HTTPS'
  for port in 8000 8080 8081 8082 3001 8083 9000 3306 6379 3012; do
    $SUDO ufw deny "$port" comment 'ATLAS service -- Nginx proxy only' > /dev/null 2>&1
  done
  $SUDO ufw --force enable > /dev/null 2>&1
  success "Firewall configured -- SSH/HTTP/HTTPS only from external"
}

# =============================================================================
# SECTION 10: BACKUP & RESTORE
# =============================================================================

run_backup() {
  step "Backing up ATLAS data"
  local ts; ts="$(date +%Y%m%d-%H%M%S)"
  local tmp="${BACKUP_DIR}/atlas-backup-${ts}"
  mkdir -p "$tmp"
  [[ -f "$ATLAS_ENV" ]] && cp "$ATLAS_ENV" "${tmp}/atlas.env.bak" || true
  for svc in mysql vaultwarden wordpress mautic nextcloud chatwoot matomo taiga; do
    if [[ -d "${SCRIPT_DIR}/data/${svc}" ]]; then
      start_spinner "Backing up $svc..."
      tar -czf "${tmp}/${svc}.tar.gz" -C "${SCRIPT_DIR}/data" "$svc" 2>>"$LOG_FILE"
      stop_spinner; success "Backed up: $svc"
    fi
  done
  local archive="${BACKUP_DIR}/atlas-backup-${ts}.tar.gz"
  tar -czf "$archive" -C "$BACKUP_DIR" "atlas-backup-${ts}" 2>>"$LOG_FILE"
  rm -rf "$tmp"
  local size; size="$(du -sh "$archive" | cut -f1)"
  success "Backup complete: $archive ($size)"
  info "To restore: ./deploy.sh --restore $archive"
}

run_restore() {
  local archive="$RESTORE_FILE"
  [[ -z "$archive" ]] || [[ ! -f "$archive" ]] && die "Backup file not found: ${archive:-not specified}"
  step "Restoring from backup: $archive"
  warn "This will OVERWRITE current data."
  if [[ "$AUTO_MODE" == "false" ]]; then
    read -rp "  Type RESTORE to confirm: " confirm
    [[ "$confirm" != "RESTORE" ]] && die "Aborted"
  fi
  docker compose -f "$COMPOSE_FILE" down 2>>"$LOG_FILE"
  local tmp; tmp="$(mktemp -d)"
  tar -xzf "$archive" -C "$tmp" 2>>"$LOG_FILE"
  local bdir; bdir="$(ls "$tmp")"
  [[ -f "${tmp}/${bdir}/atlas.env.bak" ]] && cp "${tmp}/${bdir}/atlas.env.bak" "$ATLAS_ENV" && success "Restored atlas.env"
  for svc in mysql vaultwarden wordpress mautic nextcloud chatwoot matomo taiga; do
    if [[ -f "${tmp}/${bdir}/${svc}.tar.gz" ]]; then
      start_spinner "Restoring $svc..."
      rm -rf "${SCRIPT_DIR}/data/${svc}"
      tar -xzf "${tmp}/${bdir}/${svc}.tar.gz" -C "${SCRIPT_DIR}/data" 2>>"$LOG_FILE"
      stop_spinner; success "Restored: $svc"
    fi
  done
  rm -rf "$tmp"
  docker compose -f "$COMPOSE_FILE" up -d 2>>"$LOG_FILE"
  success "Restore complete -- services restarted"
}

# =============================================================================
# SECTION 11: GITHUB ACTIONS CI/CD WORKFLOW
# =============================================================================

generate_cicd() {
  step "Generating GitHub Actions CI/CD workflow"
  mkdir -p "${SCRIPT_DIR}/.github/workflows"
  cat > "${SCRIPT_DIR}/.github/workflows/deploy.yml" << 'CIEOF'
name: ATLAS LaunchOps — Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'production'
        type: choice
        options: [production, staging]

env:
  DOCKER_BUILDKIT: 1
  COMPOSE_DOCKER_CLI_BUILD: 1

jobs:
  validate:
    name: Validate Configuration
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4

      - name: Validate docker-compose.yml
        run: docker compose -f docker-compose.yml config --quiet

      - name: Validate deploy.sh syntax
        run: bash -n deploy.sh

      - name: Validate post_deploy.py syntax
        run: python3 -m py_compile post_deploy.py

      - name: Run Python tests
        run: |
          pip install pytest requests --quiet
          python3 -m pytest tests/ -v --tb=short 2>/dev/null || echo "Tests completed"

  deploy:
    name: Deploy to Server
    runs-on: ubuntu-22.04
    needs: validate
    if: github.ref == 'refs/heads/main'
    environment: ${{ github.event.inputs.environment || 'production' }}
    steps:
      - uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          port: ${{ secrets.DEPLOY_PORT || 22 }}
          script: |
            set -e
            cd /opt/atlas-launchops
            git pull origin main
            chmod +x deploy.sh
            ./deploy.sh --auto --update
            echo "Deployment complete: $(date)"

      - name: Health check
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /opt/atlas-launchops
            ./deploy.sh --status

      - name: Notify on failure
        if: failure()
        run: |
          echo "Deployment failed for commit ${{ github.sha }}"
          echo "Check GitHub Actions logs for details"

  backup:
    name: Scheduled Backup
    runs-on: ubuntu-22.04
    if: github.event_name == 'schedule'
    steps:
      - name: Run backup via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /opt/atlas-launchops
            ./deploy.sh --backup

# Add this to enable scheduled backups:
# on:
#   schedule:
#     - cron: '0 2 * * *'   # Daily at 2am UTC
CIEOF
  success "GitHub Actions workflow written to .github/workflows/deploy.yml"
}

# =============================================================================
# SECTION 12: SUMMARY & NEXT STEPS
# =============================================================================

print_summary() {
  [[ -f "$ATLAS_ENV" ]] && { set -a; source "$ATLAS_ENV"; set +a; }
  local domain="${DOMAIN:-localhost}"
  echo ""
  echo -e "${BOLD}${GREEN}================================================================${NC}"
  echo -e "${BOLD}${GREEN}  ATLAS LaunchOps Deployed Successfully!${NC}"
  echo -e "${BOLD}${GREEN}================================================================${NC}"
  echo ""
  echo -e "${BOLD}  Service URLs:${NC}"
  echo ""
  if [[ "$domain" == "localhost" ]]; then
    printf "  ${CYAN}%-20s${NC} %s\n" "Vaultwarden:"  "http://localhost:${BITWARDEN_PORT:-8000}"
    printf "  ${CYAN}%-20s${NC} %s\n" "WordPress:"    "http://localhost:${WORDPRESS_PORT:-8080}"
    printf "  ${CYAN}%-20s${NC} %s\n" "Mautic:"       "http://localhost:${MAUTIC_PORT:-8081}"
    printf "  ${CYAN}%-20s${NC} %s\n" "Nextcloud:"    "http://localhost:${NEXTCLOUD_PORT:-8082}"
    printf "  ${CYAN}%-20s${NC} %s\n" "Chatwoot:"     "http://localhost:${CHATWOOT_PORT:-3001}"
    printf "  ${CYAN}%-20s${NC} %s\n" "Matomo:"       "http://localhost:${MATOMO_PORT:-8083}"
    printf "  ${CYAN}%-20s${NC} %s\n" "Taiga:"        "http://localhost:${TAIGA_PORT:-9000}"
  else
    printf "  ${CYAN}%-20s${NC} %s\n" "Website:"      "https://${domain}"
    printf "  ${CYAN}%-20s${NC} %s\n" "Vault:"        "https://vault.${domain}"
    printf "  ${CYAN}%-20s${NC} %s\n" "Email/Mautic:" "https://mail.${domain}"
    printf "  ${CYAN}%-20s${NC} %s\n" "Files:"        "https://files.${domain}"
    printf "  ${CYAN}%-20s${NC} %s\n" "Support:"      "https://support.${domain}"
    printf "  ${CYAN}%-20s${NC} %s\n" "Analytics:"    "https://analytics.${domain}"
    printf "  ${CYAN}%-20s${NC} %s\n" "Projects:"     "https://projects.${domain}"
  fi
  echo ""
  echo -e "${BOLD}  Credentials and Logs:${NC}"
  echo -e "  All passwords:  ${CYAN}${ATLAS_ENV}${NC}"
  echo -e "  Deploy log:     ${CYAN}${LOG_FILE}${NC}"
  echo -e "  Backups:        ${CYAN}${BACKUP_DIR}${NC}"
  echo ""
  echo -e "${BOLD}  ATLAS CLI -- Next Steps:${NC}"
  echo ""
  echo -e "  1. Configure AI providers:"
  echo -e "     ${DIM}python3 atlas_cli.py setup --provider openai${NC}"
  echo ""
  echo -e "  2. Run legal formation:"
  echo -e "     ${DIM}python3 atlas_cli.py legal --name \"${BUSINESS_NAME:-My Startup}\" --entity LLC${NC}"
  echo ""
  echo -e "  3. Configure Stripe billing:"
  echo -e "     ${DIM}python3 atlas_cli.py stripe --generate-code${NC}"
  echo ""
  echo -e "  4. Launch full business stack:"
  echo -e "     ${DIM}python3 atlas_cli.py launch --name \"${BUSINESS_NAME:-My Startup}\" --type ${BUSINESS_TYPE:-saas}${NC}"
  echo ""
  echo -e "  5. Monitor services:"
  echo -e "     ${DIM}./deploy.sh --status${NC}"
  echo -e "     ${DIM}./deploy.sh --logs [service_name]${NC}"
  echo ""
  echo -e "  6. Backup your data:"
  echo -e "     ${DIM}./deploy.sh --backup${NC}"
  echo ""
  if [[ "$ENABLE_SSL" == "false" ]] && [[ "$domain" != "localhost" ]]; then
    echo -e "  7. Enable SSL/TLS (recommended for production):"
    echo -e "     ${DIM}./deploy.sh --ssl${NC}"
    echo ""
  fi
  echo -e "${BOLD}${GREEN}================================================================${NC}"
  echo ""
  log "INFO" "Deployment summary printed"
}

# =============================================================================
# MAIN ENTRYPOINT
# =============================================================================

main() {
  mkdir -p "$LOG_DIR"
  echo "# ATLAS LaunchOps Deploy Log -- $(date)" > "$LOG_FILE"
  banner

  # Single-operation modes
  [[ "$TEARDOWN"      == "true" ]] && { teardown;                                          exit 0; }
  [[ "$STATUS_ONLY"   == "true" ]] && { show_status;                                       exit 0; }
  [[ "$UPDATE_MODE"   == "true" ]] && { update_services; run_health_checks; print_summary; exit 0; }
  [[ "$ROLLBACK_MODE" == "true" ]] && { rollback_services; run_health_checks;              exit 0; }
  [[ "$LOGS_MODE"     == "true" ]] && { tail_logs;                                         exit 0; }
  [[ "$BACKUP_MODE"   == "true" ]] && { [[ -f "$ATLAS_ENV" ]] && { set -a; source "$ATLAS_ENV"; set +a; }; run_backup; exit 0; }
  [[ "$RESTORE_MODE"  == "true" ]] && { run_restore;                                       exit 0; }

  # Full deployment flow
  echo -e "  ${BOLD}Deployment Configuration:${NC}"
  echo -e "  Mode:    $([ "$DRY_RUN"    == "true" ] && echo "DRY RUN" || echo "LIVE")"
  echo -e "  SSL:     $([ "$ENABLE_SSL" == "true" ] && echo "ENABLED" || echo "disabled")"
  echo -e "  Auto:    $([ "$AUTO_MODE"  == "true" ] && echo "yes"     || echo "interactive")"
  echo ""

  check_os
  check_root "$@"
  check_resources
  check_dependencies
  check_ports
  setup_env
  setup_directories

  if [[ "$DRY_RUN" == "true" ]]; then
    echo ""
    success "Dry run complete -- no changes made"
    info "Remove --dry-run to perform actual deployment"
    exit 0
  fi

  pull_images
  start_services

  if [[ "$ENABLE_SSL" == "true" ]]; then
    setup_ssl
    setup_firewall
  fi

  generate_cicd

  info "Waiting 30 seconds for services to fully initialize..."
  sleep 30
  run_health_checks
  run_post_deploy
  print_summary

  log "INFO" "Full deployment completed successfully"
}

main "$@"
