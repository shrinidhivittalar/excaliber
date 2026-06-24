#!/bin/bash

# Usage: ./concurrency-smoke-test.sh https://your-deployed-url.com

BASE_URL=${1:-http://localhost:3001}

echo "Firing 10 concurrent requests at $BASE_URL/api/health..."

for i in $(seq 1 10); do
  curl -s -o /dev/null -w "Request $i: %{http_code} (%{time_total}s)\n" "$BASE_URL/api/health" &
done

wait

echo "Done. All requests should return 200. Anything else means the server"
echo "couldn't handle simple concurrent load even on the lightest endpoint -"
echo "stop and investigate before testing anything heavier."
