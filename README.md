# shitshop

A lightweight, image-based webshop that sends orders via email. Perfect for small VPS hosting.

## Prerequisites

- Small VPS (512MB RAM minimum)
- Ubuntu/Debian Linux
- Node.js 16+ installed
- Domain name (optional but recommended)

## Step 1: Prepare VPS

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Create User
sudo adduser --system --group --home /home/webshop webshop

# Prepare App Directory
sudo mkdir -p /home/webshop/app
sudo chown -R webshop:webshop /home/webshop/app
```

## Step 3: Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure your settings:

```env
PORT=3000

# Email Configuration (example for Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Where orders will be sent
ORDER_EMAIL=shop-orders@example.com

# Shop Details
SHOP_NAME=My Simple Shop
SHOP_CURRENCY=EUR
```

## 3. Add Products

Place product images in the `products/` folder:

```
products/
├── shirt.jpg
├── shirt.json
├── dress.png
└── dress.json
```

Create a JSON file for each product with the same name:

**Example: `shirt.json`**
```json
{
  "name": "Cotton T-Shirt",
  "price": 24.99,
  "description": "Comfortable cotton t-shirt",
  "category": "shirt"
}
```

### Upload Files

```bash
# On your local machine
rsync -avz ./ user@your-vps-ip:/home/user/webshop/products/
```

## Step 4: Install and Configure

```bash
# Install dependencies
npm install --production

# Configure environment
cp .env.example .env
nano .env  # Edit with your settings
```

### Security Best Practices

**IMPORTANT: Do NOT run PM2 as root!** Create a dedicated user:

```bash
# Create a system user for the webshop
sudo adduser --system --group --home /home/webshop webshop

# Set up the application directory
sudo mkdir -p /home/webshop/app
sudo cp -r ./* /home/webshop/app/
sudo chown -R webshop:webshop /home/webshop/app

# Install dependencies as webshop user
cd /home/webshop/app
sudo -u webshop npm install --production
```

## Step 5: Start with PM2

```bash
# Start the application as webshop user
sudo -u webshop pm2 start server.js --name webshop

# Save PM2 configuration
sudo -u webshop pm2 save

# Enable PM2 startup on boot for webshop user
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u webshop --hp /home/webshop
```

**PM2 Commands:**
```bash
pm2 list           # View running apps
pm2 logs webshop   # View logs
pm2 restart webshop # Restart app
pm2 stop webshop   # Stop app
pm2 delete webshop # Remove app
```

## Step 6: Setup Reverse Proxy (Nginx)

```bash
# Install Nginx
sudo apt install -y nginx

# Create config
sudo nano /etc/nginx/sites-available/webshop
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Uncomment these lines after running certbot for SSL
    # listen 443 ssl http2;
    # ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    # ssl_protocols TLSv1.2 TLSv1.3;
    # ssl_ciphers HIGH:!aNULL:!MD5;
    # ssl_prefer_server_ciphers on;

    # Uncomment to redirect HTTP to HTTPS (after SSL setup)
    # if ($scheme != "https") {
    #     return 301 https://$host$request_uri;
    # }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Increase upload size if needed for large product images
    client_max_body_size 10M;
}
```

Enable the site:

```bash
# Enable configuration
sudo ln -s /etc/nginx/sites-available/webshop /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Step 7: SSL Certificate (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

## Firewall Configuration

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Updating Products

Upload new product images to the `products/` folder:

```bash
# From your local machine
scp product.jpg product.json user@your-vps-ip:/home/user/webshop/products/
```

The shop automatically detects new products on the next page load.

## Monitoring

```bash
# View application logs
pm2 logs webshop

# Monitor resource usage
pm2 monit

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Backup

```bash
# Backup products and configuration
tar -czf webshop-backup.tar.gz products/ .env

# Download backup
scp user@your-vps-ip:/home/user/webshop/webshop-backup.tar.gz ./
```

## License

Copyleft