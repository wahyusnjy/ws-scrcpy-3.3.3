#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# PUSH SCRCPY-SERVER.JAR AND START SERVER ON ALL DEVICES
# ═══════════════════════════════════════════════════════════════════════════════

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Server configuration (must match Constants.ts)
SERVER_VERSION="3.3.3"
SERVER_TYPE="web"
LOG_LEVEL="DEBUG"
SERVER_PORT="8886"
LISTEN_ALL="false"
VIDEO_CODEC="h264"
AUDIO="true"
VIDEO="true"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}        PUSH JAR + START SCRCPY SERVER ON ALL DEVICES${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Find JAR file
JAR_PATH=""
if [ -f "/home/me/ws-scrcpy-3.3.3/vendor/Genymobile/scrcpy/scrcpy-server.jar" ]; then
    JAR_PATH="/home/me/ws-scrcpy-3.3.3/vendor/Genymobile/scrcpy/scrcpy-server.jar"
elif [ -f "./vendor/Genymobile/scrcpy/scrcpy-server.jar" ]; then
    JAR_PATH="./vendor/Genymobile/scrcpy/scrcpy-server.jar"
elif [ -f "./dist/vendor/Genymobile/scrcpy/scrcpy-server.jar" ]; then
    JAR_PATH="./dist/vendor/Genymobile/scrcpy/scrcpy-server.jar"
else
    echo -e "${RED}❌ scrcpy-server.jar not found!${NC}"
    exit 1
fi

FULL_JAR_PATH=$(realpath "$JAR_PATH")
LOCAL_SIZE=$(stat -c%s "$FULL_JAR_PATH" 2>/dev/null || stat -f%z "$FULL_JAR_PATH" 2>/dev/null)
echo -e "${GREEN}📦 JAR: $FULL_JAR_PATH ($LOCAL_SIZE bytes)${NC}"
echo ""

# Get all connected devices
DEVICES=$(adb devices | grep -v "List" | grep -v "^$" | grep "device$" | awk '{print $1}')

if [ -z "$DEVICES" ]; then
    echo -e "${RED}❌ No devices connected!${NC}"
    exit 1
fi

DEVICE_COUNT=$(echo "$DEVICES" | wc -l | tr -d ' ')
echo -e "${GREEN}📱 Found ${DEVICE_COUNT} device(s)${NC}"
echo ""

# Build the run command (same as ScrcpyServer.ts)
RUN_CMD="CLASSPATH=/data/local/tmp/scrcpy-server.jar nohup app_process / com.genymobile.scrcpy.Server $SERVER_VERSION $SERVER_TYPE $LOG_LEVEL $SERVER_PORT $LISTEN_ALL $VIDEO_CODEC $AUDIO $VIDEO"

echo -e "${CYAN}Command: $RUN_CMD${NC}"
echo ""

# Process each device
SUCCESS=0
FAILED=0
CURRENT=0

for DEVICE in $DEVICES; do
    CURRENT=$((CURRENT + 1))
    
    # Tambahan Timeout 2 detik untuk mengambil nama Model agar tidak stuck
    MODEL=$(timeout 2s adb -s $DEVICE shell getprop ro.product.model 2>/dev/null | tr -d '\r\n')
    if [ -z "$MODEL" ]; then MODEL="Unknown/TimedOut"; fi
    
    echo -e "${BLUE}[$CURRENT/$DEVICE_COUNT]${NC} $DEVICE ($MODEL)"
    
    # Step 1: Push JAR with 30s Timeout
    echo -e "         ${YELLOW}[1/3] Pushing JAR (30s timeout)...${NC}"
    PUSH_OUTPUT=$(timeout 30s adb -s $DEVICE push "$FULL_JAR_PATH" /data/local/tmp/ 2>&1)
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 124 ]; then
        echo -e "         ${RED}❌ Error: Push timed out after 30 seconds!${NC}"
        FAILED=$((FAILED + 1))
        echo ""
        continue
    elif [ $EXIT_CODE -ne 0 ]; then
        echo -e "         ${RED}❌ Error: Push failed ($PUSH_OUTPUT)${NC}"
        FAILED=$((FAILED + 1))
        echo ""
        continue
    fi
    echo -e "         ${CYAN}$PUSH_OUTPUT${NC}"
    
    sleep 0.2
    
    # Step 2: Verify JAR
    echo -e "         ${YELLOW}[2/3] Verifying JAR...${NC}"
    REMOTE_SIZE=$(adb -s $DEVICE shell "stat -c%s /data/local/tmp/scrcpy-server.jar 2>/dev/null || echo 0" | tr -d '\r\n' | grep -o '[0-9]*' | head -1)
    
    if [ -z "$REMOTE_SIZE" ] || [ "$REMOTE_SIZE" -lt 100000 ]; then
        echo -e "         ${RED}❌ JAR verification failed!${NC}"
        FAILED=$((FAILED + 1))
        echo ""
        continue
    fi
    echo -e "         ${GREEN}✅ JAR verified: $REMOTE_SIZE bytes${NC}"
    
    # Step 3: Start scrcpy server in background
    echo -e "         ${YELLOW}[3/3] Starting scrcpy server...${NC}"
    
    # Run in background with nohup, redirect output to /dev/null
    adb -s $DEVICE shell "$RUN_CMD > /dev/null 2>&1 &" &
    
    sleep 0.5
    
    # Check if server started
    SERVER_PID=$(adb -s $DEVICE shell "ps -A 2>/dev/null | grep app_process | grep -v grep" | awk '{print $2}' | head -1 | tr -d '\r')
    
    if [ -n "$SERVER_PID" ]; then
        echo -e "         ${GREEN}✅ Server started (PID: $SERVER_PID)${NC}"
        SUCCESS=$((SUCCESS + 1))
    else
        echo -e "         ${RED}❌ Server failed to start${NC}"
        FAILED=$((FAILED + 1))
    fi
    
    echo ""
done

echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Success: $SUCCESS${NC}  ${RED}❌ Failed: $FAILED${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All devices ready!${NC}"
    echo -e "${YELLOW}Now run: npm start${NC}"
    echo -e "${YELLOW}Then open: http://localhost:8000/${NC}"
else
    echo -e "${YELLOW}Some devices failed. Check errors above.${NC}"
fi
echo ""