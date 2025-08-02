#!/bin/bash
echo "Starting GenVolt Backend Server..."
cd /home/site/wwwroot
echo "Current directory: $(pwd)"
echo "Files in directory:"
ls -la

echo "=== Environment Variables ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT" 
echo "FRONTEND_URL: $FRONTEND_URL"
echo "DB_SERVER: $DB_SERVER"
echo "=========================="

echo "Running environment debug..."
node debug-env.js

echo "Starting server with: node server.js"
exec node server.js