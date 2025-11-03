require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const validator = require('validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers (onclick, onerror, etc.)
      imgSrc: ["'self'", "data:"],
    },
  },
}));

// Rate limiting
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 orders per windowMs
  message: 'Too many orders from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(express.json({ limit: '10kb' })); // Limit body size
app.use(express.static('public'));
app.use('/products', express.static('products'));
app.use('/api/', apiLimiter);

// Input validation and sanitization helpers
const sanitizeString = (str, maxLength = 200) => {
  if (typeof str !== 'string') return '';
  // Remove control characters and trim
  return str.replace(/[\x00-\x1F\x7F]/g, '').trim().substring(0, maxLength);
};

const validateEmail = (email) => {
  return validator.isEmail(email) && email.length <= 254;
};

const validateOrderData = (data) => {
  const errors = [];

  if (!data.customerName || sanitizeString(data.customerName, 100).length === 0) {
    errors.push('Valid customer name is required');
  }

  if (!data.customerEmail || !validateEmail(data.customerEmail)) {
    errors.push('Valid customer email is required');
  }

  if (data.customerPhone && data.customerPhone.length > 0) {
    const sanitizedPhone = sanitizeString(data.customerPhone, 50);
    if (sanitizedPhone.length === 0) {
      errors.push('Invalid phone number');
    }
  }

  if (data.customerAddress && data.customerAddress.length > 500) {
    errors.push('Address is too long');
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    errors.push('Order must contain at least one item');
  }

  if (data.items && data.items.length > 50) {
    errors.push('Too many items in order');
  }

  if (typeof data.total !== 'number' || data.total < 0 || data.total > 1000000) {
    errors.push('Invalid order total');
  }

  return errors;
};

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

          // Limit JSON file size
          if (infoData.length > 10000) {
            console.warn(`Product JSON file too large: ${filename}.json`);
            throw new Error('JSON file too large');
          }

          const parsedInfo = JSON.parse(infoData);

          // Validate and sanitize parsed data
          productInfo = {
            id: filename,
            name: sanitizeString(parsedInfo.name || productInfo.name, 200),
            price: Math.max(0, Math.min(1000000, parseFloat(parsedInfo.price) || 0)),
            description: sanitizeString(parsedInfo.description || '', 1000),
            category: sanitizeString(parsedInfo.category || '', 100)
          };
        } catch (err) {
          // No JSON file found or invalid JSON, use defaults
          console.warn(`Could not load product info for ${filename}:`, err.message);
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
app.post('/api/order', orderLimiter, async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, customerAddress, items, total } = req.body;

    // Validate input data
    const validationErrors = validateOrderData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: validationErrors.join(', ') });
    }

    // Sanitize all inputs
    const sanitizedName = sanitizeString(customerName, 100);
    const sanitizedEmail = customerEmail.trim().toLowerCase();
    const sanitizedPhone = sanitizeString(customerPhone || '', 50);
    const sanitizedAddress = sanitizeString(customerAddress || '', 500);

    // Validate and sanitize items
    const sanitizedItems = items.slice(0, 50).map(item => ({
      name: sanitizeString(item.name, 200),
      quantity: Math.max(1, Math.min(1000, parseInt(item.quantity) || 1)),
      price: Math.max(0, Math.min(100000, parseFloat(item.price) || 0))
    }));

    // Recalculate total to prevent manipulation
    const calculatedTotal = sanitizedItems.reduce((sum, item) =>
      sum + (item.price * item.quantity), 0
    );

    // Create order details
    const itemsList = sanitizedItems.map(item =>
      `  - ${item.name} x ${item.quantity} @ ${item.price.toFixed(2)} ${process.env.SHOP_CURRENCY || 'EUR'} = ${(item.price * item.quantity).toFixed(2)} ${process.env.SHOP_CURRENCY || 'EUR'}`
    ).join('\n');

    const emailBody = `
New Order Received!

Customer Information:
---------------------
Name: ${sanitizedName}
Email: ${sanitizedEmail}
Phone: ${sanitizedPhone || 'Not provided'}
Address: ${sanitizedAddress || 'Not provided'}

Order Items:
------------
${itemsList}

Total: ${calculatedTotal.toFixed(2)} ${process.env.SHOP_CURRENCY || 'EUR'}

---
Order received at: ${new Date().toLocaleString()}
    `.trim();

    // Send email to shop owner
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ORDER_EMAIL,
      replyTo: sanitizedEmail,
      subject: `New Order from ${sanitizedName}`,
      text: emailBody
    });

    // Send confirmation to customer
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: sanitizedEmail,
      subject: `Order Confirmation - ${process.env.SHOP_NAME || 'Simple Shop'}`,
      text: `
Dear ${sanitizedName},

Thank you for your order! We have received your order and will process it shortly.

Order Summary:
${itemsList}

Total: ${calculatedTotal.toFixed(2)} ${process.env.SHOP_CURRENCY || 'EUR'}

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
