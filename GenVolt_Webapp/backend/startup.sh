#!/bin/bash
echo "Starting GenVolt Backend Server..."
cd /home/site/wwwroot
echo "Current directory: $(pwd)"
echo "Files in directory:"
ls -la
echo "Starting server with: node server.js"
exec node server.js