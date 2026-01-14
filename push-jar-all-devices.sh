#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# PUSH SCRCPY-SERVER.JAR TO ALL CONNECTED DEVICES
# With proper verification and process killing
# ═══════════════════════════════════════════════════════════════════════════════

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}              PUSH SCRCPY-SERVER.JAR TO ALL DEVICES${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Find JAR file
JAR_PATH=""
if [ -f "/home/me/ws-scrcpy-3.3.3/vendor/Genymobile/scrcpy/scrcpy-server.jar" ]; then
    JAR_PATH="/home/me/ws-scrcpy-3.3.3/vendor/Genymobile/scrcpy/scrcpy-server.jar"
elif [ -f "./vendor/Genymobile/scrcpy/scrcpy-server.jar" ]; then
    JAR_PATH="./vendor/Genymobile/scrcpy/scrcpy-server.jar"
else
    echo -e "${RED}❌ scrcpy-server.jar not found!${NC}"
    echo "Run 'npm run dist' first to build the project."
    exit 1
fi

# Get local JAR size for comparison
LOCAL_SIZE=$(stat -c%s "$JAR_PATH" 2>/dev/null || stat -f%z "$JAR_PATH" 2>/dev/null)
echo -e "${GREEN}📦 JAR found: $JAR_PATH ($LOCAL_SIZE bytes)${NC}"
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

# Process each device
SUCCESS=0
FAILED=0
CURRENT=0

for DEVICE in $DEVICES; do
    CURRENT=$((CURRENT + 1))
    MODEL=$(adb -s $DEVICE shell getprop ro.product.model 2>/dev/null | tr -d '\r\n' || echo "Unknown")
    
    echo -e "${BLUE}[$CURRENT/$DEVICE_COUNT]${NC} $DEVICE ($MODEL)"
    
    # Step 1: Kill ALL scrcpy and app_process
    echo -e "         ${YELLOW}Killing processes...${NC}"
    adb -s $DEVICE shell "pkill -9 -f scrcpy" 2>/dev/null || true
    adb -s $DEVICE shell "pkill -9 -f 'app_process.*scrcpy'" 2>/dev/null || true
    sleep 0.3
    
    # Step 2: Remove old JAR files
    echo -e "         ${YELLOW}Removing old JAR...${NC}"
    adb -s $DEVICE shell "rm -rf /data/local/tmp/scrcpy*" 2>/dev/null || true
    
    # Step 3: Push new JAR (use absolute path and push to directory)
    echo -e "         ${YELLOW}Pushing new JAR...${NC}"
    FULL_JAR_PATH=$(realpath "$JAR_PATH")
    PUSH_OUTPUT=$(adb -s $DEVICE push "$FULL_JAR_PATH" /data/local/tmp/ 2>&1)
    echo -e "         ${CYAN}$PUSH_OUTPUT${NC}"
    
    # Small delay to ensure file is written
    sleep 0.2
    
    # Step 4: Verify with actual size check
    REMOTE_SIZE=$(adb -s $DEVICE shell "stat -c%s /data/local/tmp/scrcpy-server.jar 2>/dev/null || echo 0" | tr -d '\r\n')
    
    # Remove any non-numeric characters
    REMOTE_SIZE=$(echo "$REMOTE_SIZE" | grep -o '[0-9]*' | head -1)
    
    if [ -z "$REMOTE_SIZE" ]; then
        REMOTE_SIZE=0
    fi
    
    if [ "$REMOTE_SIZE" -gt 100000 ]; then
        echo -e "         ${GREEN}✅ Verified: $REMOTE_SIZE bytes${NC}"
        SUCCESS=$((SUCCESS + 1))
    else
        echo -e "         ${RED}❌ FAILED! Remote size: $REMOTE_SIZE${NC}"
        echo -e "         ${RED}   Push output: $PUSH_OUTPUT${NC}"
        
        # Try alternative verification
        ALT_CHECK=$(adb -s $DEVICE shell "ls -la /data/local/tmp/scrcpy* 2>/dev/null" | tr -d '\r')
        if [ -n "$ALT_CHECK" ]; then
            echo -e "         ${YELLOW}   Alt check: $ALT_CHECK${NC}"
        fi
        
        FAILED=$((FAILED + 1))
    fi
    
    echo ""
done

echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Success: $SUCCESS${NC}  ${RED}❌ Failed: $FAILED${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All devices ready! Run 'npm start' to start ws-scrcpy server${NC}"
else
    echo -e "${YELLOW}Some devices failed. Check errors above.${NC}"
fi
echo ""
