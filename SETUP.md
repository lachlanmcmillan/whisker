# Server Setup

Instructions for setting up a fresh Ubuntu server to host Whisker.

## Prerequisites

- An Ubuntu server with SSH access
- An A record for `api.whisker.lmcmillan.dev` pointing to the server's IP
- Ports 80 and 443 open in the server's security group (80 for Let's Encrypt cert challenges, 443 for HTTPS)

## 1. Install Bun

```sh
curl -fsSL https://bun.sh/install | bash
```

## 2. Install PM2

```sh
bun install -g pm2
```

## 3. Clone the repo

```sh
git clone <repo-url> ~/whisker
cd ~/whisker
bun install
```

## 4. Configure environment

Create a `.env.local` file in the repo root with your production values:

```sh
cat > ~/whisker/.env.local <<'EOF'
API_KEY=your-api-key-here
DEPLOY_CORS_ORIGIN=https://whisker.lmcmillan.dev
EOF
```

## 5. Initial deploy

```sh
cd ~/whisker
bash scripts/deploy.sh
```

This runs migrations and starts the app via PM2.

## 6. Enable PM2 on boot

```sh
pm2 startup
pm2 save
```

## 7. Install Caddy

```sh
sudo apt-get update
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
```

## 8. Configure Caddy

Write the Caddyfile:

```sh
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
api.whisker.lmcmillan.dev {
    reverse_proxy localhost:3000
}
EOF
```

## 9. Start Caddy

```sh
sudo systemctl enable caddy
sudo systemctl restart caddy
```

Check status with:

```sh
sudo systemctl status caddy
journalctl -xeu caddy.service
```
