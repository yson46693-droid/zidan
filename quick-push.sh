#!/bin/bash
# Script for Git Push (Bash version)
# UTF-8 encoding

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Change to script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo -e "${YELLOW}Adding files...${NC}"

# Add all files
git add -A

# Check for changes
STATUS=$(git status --porcelain)
if [ -z "$STATUS" ]; then
    echo -e "${CYAN}No changes to commit${NC}"
    exit 0
fi

# Create commit
MSG="Update - $(date '+%Y-%m-%d %H:%M')"
echo -e "${YELLOW}Creating commit...${NC}"
git commit -m "$MSG"

if [ $? -ne 0 ]; then
    echo -e "${RED}Error creating commit${NC}"
    exit 1
fi

# Fetch latest changes from remote
echo -e "${YELLOW}Fetching latest changes from remote...${NC}"
FETCH_OUTPUT=$(git fetch origin main 2>&1)
FETCH_EXIT=$?

if [ $FETCH_EXIT -ne 0 ]; then
    if echo "$FETCH_OUTPUT" | grep -qE "Recv failure|Connection was reset|Connection timed out"; then
        echo -e "${YELLOW}Warning: Network error during fetch. This may affect push.${NC}"
    else
        echo -e "${YELLOW}Warning: Could not fetch from remote. Continuing with push...${NC}"
    fi
fi

# Check if local branch is behind remote
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/main 2>/dev/null)

if [ $? -eq 0 ] && [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
    echo -e "${YELLOW}Remote has new changes. Pulling changes...${NC}"
    git pull origin main --no-rebase

    if [ $? -ne 0 ]; then
        echo -e "${RED}Error during pull. You may need to resolve conflicts manually.${NC}"
        echo -e "${YELLOW}Run 'git pull origin main' manually to resolve conflicts.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Pull completed successfully!${NC}"
fi

# Check network connectivity
test_network() {
    if command -v nc &>/dev/null; then
        nc -z -w 3 github.com 443 2>/dev/null
        return $?
    fi
    if command -v timeout &>/dev/null; then
        timeout 3 bash -c "echo >/dev/tcp/github.com/443" 2>/dev/null
        return $?
    fi
    ping -c 1 -W 3 github.com &>/dev/null
    return $?
}

# Get git remote URL
get_remote_url() {
    git remote get-url origin 2>/dev/null
}

# Check network connectivity before push
echo -e "${YELLOW}Checking network connectivity...${NC}"
if ! test_network; then
    echo -e "${YELLOW}Warning: Cannot reach github.com. Network may be down or blocked.${NC}"
    echo -e "${YELLOW}Attempting push anyway...${NC}"
fi

# Check remote URL
REMOTE_URL=$(get_remote_url)
if [ -n "$REMOTE_URL" ]; then
    echo -e "${CYAN}Remote URL: $REMOTE_URL${NC}"
fi

# Push to GitHub with retry logic
echo -e "${YELLOW}Pushing to GitHub...${NC}"
MAX_RETRIES=3
RETRY_COUNT=0
PUSH_SUCCESS=false

# Git config for large files
export GIT_HTTP_BUFFER=524288000  # 500MB
git config --global http.postBuffer 524288000
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$PUSH_SUCCESS" = false ]; do
    if [ $RETRY_COUNT -gt 0 ]; then
        WAIT_TIME=$((RETRY_COUNT * 2))
        [ $WAIT_TIME -gt 10 ] && WAIT_TIME=10
        echo -e "${YELLOW}Retry attempt $RETRY_COUNT of $MAX_RETRIES (waiting ${WAIT_TIME}s)...${NC}"
        sleep $WAIT_TIME
    fi

    PUSH_OUTPUT=$(git push origin main 2>&1)
    PUSH_EXIT=$?

    if [ $PUSH_EXIT -eq 0 ]; then
        echo -e "${GREEN}Push completed successfully!${NC}"
        PUSH_SUCCESS=true
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))

        if echo "$PUSH_OUTPUT" | grep -qE "Recv failure|Connection was reset|Connection timed out|Failed to connect"; then
            echo -e "${RED}Connection error detected: $(echo "$PUSH_OUTPUT" | head -1)${NC}"
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                echo -e "${YELLOW}This appears to be a network issue. Will retry...${NC}"
                continue
            fi
        elif echo "$PUSH_OUTPUT" | grep -qiE "authentication|unauthorized|403|401"; then
            echo -e "${RED}Authentication error detected!${NC}"
            echo -e "${YELLOW}You may need to:${NC}"
            echo -e "${YELLOW}  - Update your GitHub credentials${NC}"
            echo -e "${YELLOW}  - Use a Personal Access Token (PAT)${NC}"
            echo -e "${YELLOW}  - Check if your token has expired${NC}"
            break
        elif echo "$PUSH_OUTPUT" | grep -qiE "rejected|non-fast-forward|conflict"; then
            echo -e "${RED}Push rejected! Remote has changes you don't have locally.${NC}"
            echo -e "${YELLOW}Run 'git pull origin main' first, then try again.${NC}"
            break
        else
            echo -e "${RED}Push failed with error:${NC}"
            echo -e "${RED}$PUSH_OUTPUT${NC}"
        fi
    fi
done

if [ "$PUSH_SUCCESS" = false ]; then
    echo -e "\n${RED}Push failed after $MAX_RETRIES attempts${NC}"
    echo -e "\n${YELLOW}Troubleshooting steps:${NC}"
    echo -e "${CYAN}1. Check internet connection: nc -zv github.com 443${NC}"
    echo -e "${CYAN}2. Verify authentication:${NC}"
    echo -e "${GRAY}   - Check: git config --global user.name${NC}"
    echo -e "${GRAY}   - Check: git config --global user.email${NC}"
    echo -e "${GRAY}   - For HTTPS: Update credentials / use PAT${NC}"
    echo -e "${GRAY}   - For SSH: Check SSH key: ssh -T git@github.com${NC}"
    echo -e "${CYAN}3. Check remote URL: git remote -v${NC}"
    echo -e "${CYAN}4. Try manual push: git push origin main${NC}"
    echo -e "${CYAN}5. If using proxy/VPN, check if it's blocking GitHub${NC}"
    echo -e "${CYAN}6. Check GitHub status: https://www.githubstatus.com${NC}"

    echo -e "\n${YELLOW}Current Git Configuration:${NC}"
    echo -e "${GRAY}Remote URL: $REMOTE_URL${NC}"
    GIT_USER=$(git config --global user.name 2>/dev/null)
    GIT_EMAIL=$(git config --global user.email 2>/dev/null)
    [ -n "$GIT_USER" ] && echo -e "${GRAY}User: $GIT_USER${NC}"
    [ -n "$GIT_EMAIL" ] && echo -e "${GRAY}Email: $GIT_EMAIL${NC}"

    exit 1
fi
