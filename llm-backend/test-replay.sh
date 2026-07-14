#!/bin/bash
# Test script for the Replay Engine
source ~/.nvm/nvm.sh
cd /home/rafli/magang_utp/application/llm-backend

# Start server in background
node index.js > /tmp/replay.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
sleep 3

echo ""
echo "=== TEST 1: GET /api/models ==="
curl -s http://localhost:3000/api/models | python3 -m json.tool | grep -E '"id"|"type"'

echo ""
echo "=== TEST 2: POST /api/chat (llama3.1:8b, users=1) ==="
PAYLOAD='{"prompt":"Extract products from page 1","modelIds":["llama3.1:8b"],"users":1}'
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data.get('success'):
    for r in data['responses']:
        print('Model:', r['modelId'])
        print('Success:', r['success'])
        if r['success']:
            print('Answer preview:')
            print(r['answer'][:600])
else:
    print('ERROR:', data.get('error'))
"

echo ""
echo "=== TEST 3: POST /api/chat (qwen2.5-coder:14b, users=4) ==="
PAYLOAD2='{"prompt":"Extract products from page 3","modelIds":["qwen2.5-coder:14b"],"users":4}'
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD2" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data.get('success'):
    for r in data['responses']:
        print('Model:', r['modelId'], '| Success:', r['success'])
        if r['success']:
            print(r['answer'][:400])
        else:
            print('Error:', r.get('error'))
else:
    print('ERROR:', data.get('error'))
"

echo ""
echo "=== SERVER LOGS ==="
grep -E 'MODEL:|REPLAY|ERROR|Found' /tmp/replay.log

kill $SERVER_PID 2>/dev/null
echo ""
echo "Test complete."
