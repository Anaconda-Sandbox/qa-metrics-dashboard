#!/bin/bash
set -e

EC2_HOST="ubuntu@ec2-98-92-87-222.compute-1.amazonaws.com"
EC2_KEY="$HOME/Downloads/qa_manual_key.pem"
REMOTE_DIR="~/qa-dashboard"

echo "==> Syncing code to EC2..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '*.pyc' \
  --exclude '__pycache__' \
  --exclude '.venv' \
  --exclude '.env' \
  --exclude 'deploy.sh' \
  --exclude 'k8s' \
  -e "ssh -i $EC2_KEY" \
  ./ "$EC2_HOST:$REMOTE_DIR/"

echo "==> Syncing .env file..."
scp -i "$EC2_KEY" .env "$EC2_HOST:$REMOTE_DIR/.env" 2>/dev/null || echo "    (no local .env, using existing on server)"

echo "==> Rebuilding and restarting containers..."
ssh -i "$EC2_KEY" "$EC2_HOST" "cd $REMOTE_DIR && sudo docker compose up --build -d"

echo "==> Waiting for health check..."
sleep 5
ssh -i "$EC2_KEY" "$EC2_HOST" "curl -s http://localhost/health"

echo ""
echo "==> Deploy complete! App is live at:"
echo "    http://ec2-98-92-87-222.compute-1.amazonaws.com"
