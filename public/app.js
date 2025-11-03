// App State
let products = [];
let cart = [];
let currency = 'EUR';
let currentCategory = 'all';
let categories = ['all'];

// DOM Elements
const productsGrid = document.getElementById('products-grid');
const cartBtn = document.getElementById('cart-btn');
const cartCount = document.getElementById('cart-count');
const cartModal = document.getElementById('cart-modal');
const checkoutModal = document.getElementById('checkout-modal');
const successModal = document.getElementById('success-modal');
const productModal = document.getElementById('product-modal');
const checkoutForm = document.getElementById('checkout-form');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadCart();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    cartBtn.addEventListener('click', () => openModal(cartModal));

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            closeModal(e.target.closest('.modal'));
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });

    document.getElementById('checkout-btn').addEventListener('click', () => {
        if (cart.length === 0) {
            alert('Your cart is empty!');
            return;
        }
        closeModal(cartModal);
        openModal(checkoutModal);
        renderCheckoutItems();
    });

    checkoutForm.addEventListener('submit', handleCheckout);
}

// Load Products
async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        products = await response.json();
        extractCategories();
        renderCategoryFilter();
        renderProducts();
    } catch (error) {
        console.error('Error loading products:', error);
        productsGrid.innerHTML = '<p class="loading">Error loading products. Please refresh the page.</p>';
    }
}

// Extract categories from products
function extractCategories() {
    const categorySet = new Set(['all']);
    products.forEach(product => {
        if (product.category) {
            categorySet.add(product.category);
        }
    });
    categories = Array.from(categorySet);
}

// Render category filter buttons
function renderCategoryFilter() {
    const filterContainer = document.getElementById('category-filter');

    filterContainer.innerHTML = categories.map(category => `
        <button class="category-btn ${category === currentCategory ? 'active' : ''}"
                onclick="filterByCategory('${category}')"
                data-category="${category}">
            ${category.charAt(0).toUpperCase() + category.slice(1)}
        </button>
    `).join('');
}

// Filter products by category
function filterByCategory(category) {
    currentCategory = category;
    renderCategoryFilter();
    renderProducts();
}

// Render Products
function renderProducts() {
    if (products.length === 0) {
        productsGrid.innerHTML = '<p class="loading">No products available yet. Add images to the "products" folder.</p>';
        return;
    }

    // Filter products by category
    const filteredProducts = currentCategory === 'all'
        ? products
        : products.filter(p => p.category === currentCategory);

    if (filteredProducts.length === 0) {
        productsGrid.innerHTML = '<p class="loading">No products in this category.</p>';
        return;
    }

    productsGrid.innerHTML = filteredProducts.map(product => `
        <div class="product-card" onclick="openProductDetail('${product.id}')">
            <img src="${product.image}" alt="${product.name}" class="product-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22250%22 height=%22250%22%3E%3Crect fill=%22%23ddd%22 width=%22250%22 height=%22250%22/%3E%3Ctext fill=%22%23999%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENo Image%3C/text%3E%3C/svg%3E'">
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                ${product.description ? `<p class="product-description">${product.description}</p>` : ''}
                <p class="product-price">${product.price.toFixed(2)} ${currency}</p>
                <button class="btn add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}')">
                    Add to Cart
                </button>
            </div>
        </div>
    `).join('');
}

// Cart Functions
function loadCart() {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartUI();
    }
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: parseFloat(product.price),
            quantity: 1
        });
    }

    saveCart();

    // Visual feedback
    cartBtn.style.transform = 'scale(1.1)';
    setTimeout(() => {
        cartBtn.style.transform = 'scale(1)';
    }, 200);
}

function updateQuantity(productId, delta) {
    const item = cart.find(item => item.id === productId);
    if (!item) return;

    item.quantity += delta;

    if (item.quantity <= 0) {
        removeFromCart(productId);
    } else {
        saveCart();
        renderCart();
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
}

function renderCart() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalElement = document.getElementById('cart-total');

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
        cartTotalElement.textContent = '0.00';
        return;
    }

    const total = cart.reduce((sum, item) => {
        const price = parseFloat(item.price) || 0;
        const quantity = parseInt(item.quantity) || 0;
        return sum + (price * quantity);
    }, 0);

    cartItemsContainer.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">${parseFloat(item.price).toFixed(2)} ${currency}</div>
            </div>
            <div class="cart-item-controls">
                <button class="quantity-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                <button class="remove-btn" onclick="removeFromCart('${item.id}')">Remove</button>
            </div>
        </div>
    `).join('');

    cartTotalElement.textContent = total.toFixed(2);
}

function renderCheckoutItems() {
    const checkoutItemsContainer = document.getElementById('checkout-items');
    const checkoutTotalElement = document.getElementById('checkout-total');

    const total = cart.reduce((sum, item) => {
        const price = parseFloat(item.price) || 0;
        const quantity = parseInt(item.quantity) || 0;
        return sum + (price * quantity);
    }, 0);

    checkoutItemsContainer.innerHTML = cart.map(item => {
        const price = parseFloat(item.price) || 0;
        const quantity = parseInt(item.quantity) || 0;
        return `
            <div class="checkout-item">
                <span>${item.name} x ${quantity}</span>
                <span>${(price * quantity).toFixed(2)} ${currency}</span>
            </div>
        `;
    }).join('');

    checkoutTotalElement.textContent = total.toFixed(2);
}

// Checkout
async function handleCheckout(e) {
    e.preventDefault();

    const formData = new FormData(checkoutForm);
    const customerData = Object.fromEntries(formData.entries());

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const orderData = {
        ...customerData,
        items: cart,
        total: total
    };

    try {
        const response = await fetch('/api/order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            throw new Error('Failed to submit order');
        }

        // Clear cart
        cart = [];
        saveCart();

        // Show success modal
        closeModal(checkoutModal);
        openModal(successModal);

        // Reset form
        checkoutForm.reset();
    } catch (error) {
        console.error('Error submitting order:', error);
        alert('Failed to submit order. Please try again.');
    }
}

// Product Detail
function openProductDetail(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('product-modal-name').textContent = product.name;
    document.getElementById('product-modal-image').src = product.image;
    document.getElementById('product-modal-image').alt = product.name;
    document.getElementById('product-modal-description').textContent = product.description || '';
    document.getElementById('product-modal-price').textContent = `${product.price.toFixed(2)} ${currency}`;

    // Update add to cart button
    const addBtn = document.getElementById('product-modal-add-btn');
    addBtn.onclick = () => {
        addToCart(productId);
        closeModal(productModal);
    };

    openModal(productModal);
}

// Modal Functions
function openModal(modal) {
    modal.classList.add('active');
    if (modal === cartModal) {
        renderCart();
    }
}

function closeModal(modal) {
    modal.classList.remove('active');
}
