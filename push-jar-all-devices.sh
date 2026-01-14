#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# PUSH SCRCPY-SERVER.JAR TO ALL CONNECTED DEVICES
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
if [ -f "./dist/vendor/Genymobile/scrcpy/scrcpy-server.jar" ]; then
    JAR_PATH="./dist/vendor/Genymobile/scrcpy/scrcpy-server.jar"
elif [ -f "./vendor/Genymobile/scrcpy/scrcpy-server.jar" ]; then
    JAR_PATH="./vendor/Genymobile/scrcpy/scrcpy-server.jar"
else
    echo -e "${RED}❌ scrcpy-server.jar not found!${NC}"
    echo "Run 'npm run dist' first to build the project."
    exit 1
fi

JAR_SIZE=$(stat -c%s "$JAR_PATH" 2>/dev/null || stat -f%z "$JAR_PATH" 2>/dev/null)
echo -e "${GREEN}📦 JAR found: $JAR_PATH ($JAR_SIZE bytes)${NC}"
echo ""

# Get all connected devices
DEVICES=$(adb devices | grep -v "List" | grep -v "^$" | awk '{print $1}')

if [ -z "$DEVICES" ]; then
    echo -e "${RED}❌ No devices connected!${NC}"
    exit 1
fi

DEVICE_COUNT=$(echo "$DEVICES" | wc -l)
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
    
    # Kill existing scrcpy processes
    adb -s $DEVICE shell "pkill -f scrcpy" 2>/dev/null || true
    
    # Remove old JAR
    adb -s $DEVICE shell "rm -f /data/local/tmp/scrcpy*" 2>/dev/null || true
    
    # Push new JAR
    PUSH_OUTPUT=$(adb -s $DEVICE push "$JAR_PATH" /data/local/tmp/scrcpy-server.jar 2>&1)
    
    # Verify
    VERIFY=$(adb -s $DEVICE shell "ls /data/local/tmp/scrcpy-server.jar 2>/dev/null" | tr -d '\r')
    
    if [ -n "$VERIFY" ]; then
        echo -e "         ${GREEN}✅ Pushed successfully${NC}"
        SUCCESS=$((SUCCESS + 1))
    else
        echo -e "         ${RED}❌ Failed to push${NC}"
        echo -e "         ${RED}   $PUSH_OUTPUT${NC}"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Success: $SUCCESS${NC}  ${RED}❌ Failed: $FAILED${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Next: Run 'npm start' to start ws-scrcpy server${NC}"
echo ""
