require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/products', express.static('products'));

// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Get all products from the products folder
app.get('/api/products', async (req, res) => {
  try {
    const productsDir = path.join(__dirname, 'products');

    // Create products directory if it doesn't exist
    try {
      await fs.access(productsDir);
    } catch {
      await fs.mkdir(productsDir, { recursive: true });
    }

    const files = await fs.readdir(productsDir);

    // Filter for image files
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const products = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (imageExtensions.includes(ext)) {
        const filename = path.parse(file).name;

        // Try to load product info from JSON file
        let productInfo = {
          id: filename,
          name: filename.replace(/_/g, ' ').replace(/-/g, ' '),
          price: 0,
          description: ''
        };

        try {
          const infoPath = path.join(productsDir, `${filename}.json`);
          const infoData = await fs.readFile(infoPath, 'utf-8');
          const parsedInfo = JSON.parse(infoData);
          productInfo = { ...productInfo, ...parsedInfo, id: filename };
        } catch {
          // No JSON file found, use defaults
        }

        products.push({
          ...productInfo,
          image: `/products/${file}`
        });
      }
    }

    res.json(products);
  } catch (error) {
    console.error('Error loading products:', error);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// Submit order endpoint
app.post('/api/order', async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, customerAddress, items, total } = req.body;

    // Validate required fields
    if (!customerName || !customerEmail || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create order details
    const itemsList = items.map(item =>
      `  - ${item.name} x ${item.quantity} @ ${item.price} ${process.env.SHOP_CURRENCY || 'EUR'} = ${(item.price * item.quantity).toFixed(2)} ${process.env.SHOP_CURRENCY || 'EUR'}`
    ).join('\n');

    const emailBody = `
New Order Received!

Customer Information:
---------------------
Name: ${customerName}
Email: ${customerEmail}
Phone: ${customerPhone || 'Not provided'}
Address: ${customerAddress || 'Not provided'}

Order Items:
------------
${itemsList}

Total: ${total.toFixed(2)} ${process.env.SHOP_CURRENCY || 'EUR'}

---
Order received at: ${new Date().toLocaleString()}
    `.trim();

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ORDER_EMAIL,
      subject: `New Order from ${customerName}`,
      text: emailBody
    });

    // Send confirmation to customer
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: customerEmail,
      subject: `Order Confirmation - ${process.env.SHOP_NAME || 'Simple Shop'}`,
      text: `
Dear ${customerName},

Thank you for your order! We have received your order and will process it shortly.

Order Summary:
${itemsList}

Total: ${total.toFixed(2)} ${process.env.SHOP_CURRENCY || 'EUR'}

We will contact you soon regarding payment and delivery.

Best regards,
${process.env.SHOP_NAME || 'Simple Shop'}
      `.trim()
    });

    res.json({ success: true, message: 'Order submitted successfully' });
  } catch (error) {
    console.error('Error submitting order:', error);
    res.status(500).json({ error: 'Failed to submit order' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Shop: ${process.env.SHOP_NAME || 'Simple Shop'}`);
});
