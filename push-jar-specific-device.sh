#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# PUSH SCRCPY-SERVER.JAR AND START SERVER ON SPECIFIC DEVICE
# Usage: ./push-jar-specific-device.sh <DEVICE_UDID>
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

# Check if device UDID is provided
if [ -z "$1" ]; then
    echo ""
    echo -e "${RED}❌ Error: Device UDID required!${NC}"
    echo ""
    echo -e "${YELLOW}Usage:${NC}"
    echo -e "  ./push-jar-specific-device.sh <DEVICE_UDID>"
    echo ""
    echo -e "${YELLOW}Example:${NC}"
    echo -e "  ./push-jar-specific-device.sh R9RY101CECA"
    echo ""
    echo -e "${CYAN}Connected devices:${NC}"
    adb devices -l
    echo ""
    exit 1
fi

DEVICE="$1"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}        PUSH JAR + START SCRCPY SERVER ON DEVICE: $DEVICE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if device is connected
DEVICE_STATUS=$(adb devices | grep "^$DEVICE" | awk '{print $2}')

if [ "$DEVICE_STATUS" != "device" ]; then
    echo -e "${RED}❌ Device $DEVICE is not connected or not in 'device' mode!${NC}"
    echo ""
    echo -e "${CYAN}Connected devices:${NC}"
    adb devices -l
    echo ""
    exit 1
fi

# Get device model
MODEL=$(adb -s $DEVICE shell getprop ro.product.model 2>/dev/null | tr -d '\r\n' || echo "Unknown")
echo -e "${GREEN}📱 Device: $DEVICE ($MODEL)${NC}"
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

# Build the run command (same as ScrcpyServer.ts)
RUN_CMD="CLASSPATH=/data/local/tmp/scrcpy-server.jar nohup app_process / com.genymobile.scrcpy.Server $SERVER_VERSION $SERVER_TYPE $LOG_LEVEL $SERVER_PORT $LISTEN_ALL $VIDEO_CODEC $AUDIO $VIDEO"

echo -e "${CYAN}Command: $RUN_CMD${NC}"
echo ""

# Step 1: Push JAR
echo -e "${YELLOW}[1/3] Pushing JAR to device...${NC}"
PUSH_OUTPUT=$(adb -s $DEVICE push "$FULL_JAR_PATH" /data/local/tmp/ 2>&1)
echo -e "${CYAN}$PUSH_OUTPUT${NC}"

sleep 0.2

# Step 2: Verify JAR
echo ""
echo -e "${YELLOW}[2/3] Verifying JAR on device...${NC}"
REMOTE_SIZE=$(adb -s $DEVICE shell "stat -c%s /data/local/tmp/scrcpy-server.jar 2>/dev/null || echo 0" | tr -d '\r\n' | grep -o '[0-9]*' | head -1)

if [ -z "$REMOTE_SIZE" ] || [ "$REMOTE_SIZE" -lt 100000 ]; then
    echo -e "${RED}❌ JAR verification failed!${NC}"
    echo ""
    exit 1
fi
echo -e "${GREEN}✅ JAR verified: $REMOTE_SIZE bytes${NC}"

# Step 3: Kill any existing server
echo "" 
echo -e "${YELLOW}[3/3] Starting scrcpy server...${NC}"
echo -e "${CYAN}    • Killing old server process...${NC}"
adb -s $DEVICE shell "pkill -f scrcpy-server.jar" 2>/dev/null
adb -s $DEVICE shell "pkill -f app_process.*scrcpy" 2>/dev/null
sleep 0.3

# Start scrcpy server in background
echo -e "${CYAN}    • Starting new server...${NC}"
adb -s $DEVICE shell "$RUN_CMD > /dev/null 2>&1 &" &

sleep 0.5

# Check if server started
SERVER_PID=$(adb -s $DEVICE shell "ps -A 2>/dev/null | grep app_process | grep -v grep" | awk '{print $2}' | head -1 | tr -d '\r')

echo ""
if [ -n "$SERVER_PID" ]; then
    echo -e "${GREEN}✅ Server started successfully! (PID: $SERVER_PID)${NC}"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ DEVICE READY!${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "  1. Run: ${GREEN}npm start${NC}"
    echo -e "  2. Open: ${GREEN}http://localhost:8000/${NC}"
    echo -e "  3. Your device should appear in the list"
    echo ""
else
    echo -e "${RED}❌ Server failed to start!${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo -e "  • Check device connection: ${GREEN}adb devices${NC}"
    echo -e "  • Check device logs: ${GREEN}adb -s $DEVICE logcat | grep scrcpy${NC}"
    echo -e "  • Try reset: ${GREEN}./reset-device.sh $DEVICE${NC}"
    echo ""
    exit 1
fi
