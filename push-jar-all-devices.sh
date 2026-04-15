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
INJECT_MOUSE="true"    # Tambahan baru
UHID_KEYBOARD="true"   # Tambahan baru
BITRATE="1000000"      # 1 Mbps sesuai permintaanmu

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

# Build the run command
# RUN_CMD="CLASSPATH=/data/local/tmp/scrcpy-server.jar nohup app_process / com.genymobile.scrcpy.Server $SERVER_VERSION $SERVER_TYPE $LOG_LEVEL $SERVER_PORT $LISTEN_ALL $VIDEO_CODEC $AUDIO $VIDEO"
RUN_CMD="CLASSPATH=/data/local/tmp/scrcpy-server.jar nohup app_process / com.genymobile.scrcpy.Server $SERVER_VERSION $SERVER_TYPE $LOG_LEVEL $SERVER_PORT $LISTEN_ALL $VIDEO_CODEC $INJECT_MOUSE $UHID_KEYBOARD $BITRATE"

echo -e "${CYAN}Command: $RUN_CMD${NC}"
echo ""

# Process each device
SUCCESS=0
FAILED=0
CURRENT=0

for DEVICE in $DEVICES; do
    CURRENT=$((CURRENT + 1))
    
    # --- PROSES AMBIL MODEL DENGAN TIMEOUT & SKIP ---
    MODEL=$(timeout 2s adb -s $DEVICE shell getprop ro.product.model 2>/dev/null | tr -d '\r\n')
    MODEL_STATUS=$?

    if [ $MODEL_STATUS -eq 124 ]; then
        echo -e "${RED}[$CURRENT/$DEVICE_COUNT] ⏩ Skipping $DEVICE: Device not responding (Model Timeout)${NC}"
        FAILED=$((FAILED + 1))
        echo ""
        continue
    fi
    
    [ -z "$MODEL" ] && MODEL="Unknown Device"
    echo -e "${BLUE}[$CURRENT/$DEVICE_COUNT]${NC} $DEVICE ($MODEL)"
    
    # --- STEP 1: PUSH JAR DENGAN TIMEOUT & SKIP ---
    echo -e "         ${YELLOW}[1/3] Pushing JAR (30s timeout)...${NC}"
    PUSH_OUTPUT=$(timeout 30s adb -s $DEVICE push "$FULL_JAR_PATH" /data/local/tmp/ 2>&1)
    PUSH_STATUS=$?
    
    if [ $PUSH_STATUS -eq 124 ]; then
        echo -e "         ${RED}❌ Error: Push timed out! Skipping device...${NC}"
        FAILED=$((FAILED + 1))
        echo ""
        continue
    elif [ $PUSH_STATUS -ne 0 ]; then
        echo -e "         ${RED}❌ Error: Push failed! Skipping device...${NC}"
        FAILED=$((FAILED + 1))
        echo ""
        continue
    fi
    echo -e "         ${CYAN}$PUSH_OUTPUT${NC}"
    
    sleep 0.2
    
    # --- STEP 2: VERIFY JAR ---
    echo -e "         ${YELLOW}[2/3] Verifying JAR...${NC}"
    REMOTE_SIZE=$(adb -s $DEVICE shell "stat -c%s /data/local/tmp/scrcpy-server.jar 2>/dev/null || echo 0" | tr -d '\r\n' | grep -o '[0-9]*' | head -1)
    
    if [ -z "$REMOTE_SIZE" ] || [ "$REMOTE_SIZE" -lt 100000 ]; then
        echo -e "         ${RED}❌ JAR verification failed! Skipping...${NC}"
        FAILED=$((FAILED + 1))
        echo ""
        continue
    fi
    echo -e "         ${GREEN}✅ JAR verified: $REMOTE_SIZE bytes${NC}"
    
    # --- STEP 3: START SERVER ---
    echo -e "         ${YELLOW}[3/3] Starting scrcpy server...${NC}"
    adb -s $DEVICE shell "$RUN_CMD > /dev/null 2>&1 &" &
    
    sleep 0.7 # Sedikit lebih lama agar adb shell stabil
    
    # Check PID
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
echo -e "${GREEN}✅ Success: $SUCCESS${NC}  ${RED}❌ Failed/Skipped: $FAILED${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All devices ready!${NC}"
else
    echo -e "${YELLOW}$FAILED device(s) were skipped or failed. Check logs above.${NC}"
fi
echo ""