let allMedicines = [];
let cart = [];

// Keyboard Shortcuts System (F3 for Search, F2 for Clear)
document.addEventListener('keydown', (e) => {
  if (e.key === 'F3') {
    e.preventDefault();
    document.getElementById('searchInput').focus();
  }
  if (e.key === 'F2') {
    e.preventDefault();
    cart = [];
    updateCart();
  }
});

// Part-by-Part JSON Data Loader Function
async function loadMedicineParts() {
  const totalParts = 1; // Jab naye JSON files banenge toh count 2, 3, 4 kar sakte hain

  for (let i = 1; i <= totalParts; i++) {
    try {
      const response = await fetch(`./data/medicines_part${i}.json`);
      const data = await response.json();
      allMedicines = [...allMedicines, ...data];
      
      document.getElementById('totalStockCount').innerText = allMedicines.length;
      displayMedicines(allMedicines);
    } catch (error) {
      console.error(`Part ${i} load nahi ho saka:`, error);
    }
  }
}

// Display Medicines in Grid
function displayMedicines(list) {
  const container = document.getElementById('medicineList');
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<p>Koi medicine nahi mili.</p>';
    return;
  }

  list.slice(0, 40).forEach(med => {
    const card = `
      <div class="card">
        <h4>${med.name}</h4>
        <p><b>Generic:</b> ${med.generic}</p>
        <span class="badge-sub">${med.category}</span>
        <p><strong>MRP: ₹${med.mrp}</strong></p>
        <button class="btn-add" onclick="addToCart('${med.id}')">+ Add to Bill</button>
      </div>
    `;
    container.innerHTML += card;
  });
}

// Fast Billing Cart Logics
function addToCart(medId) {
  const med = allMedicines.find(item => item.id === medId);
  if (med) {
    cart.push(med);
    updateCart();
  }
}

function updateCart() {
  const cartContainer = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');
  
  cartContainer.innerHTML = '';
  let total = 0;

  if (cart.length === 0) {
    cartContainer.innerHTML = '<p class="empty-msg">Koi medicine select nahi hui hai.</p>';
    cartTotal.innerText = '₹0.00';
    return;
  }

  cart.forEach((item) => {
    total += Number(item.mrp);
    cartContainer.innerHTML += `
      <div class="cart-item">
        <span>${item.name}</span>
        <strong>₹${item.mrp}</strong>
      </div>
    `;
  });

  cartTotal.innerText = `₹${total.toFixed(2)}`;
}

// Live Search Engine
document.getElementById('searchInput').addEventListener('keyup', (e) => {
  const query = e.target.value.toLowerCase().trim();
  const filtered = allMedicines.filter(med => 
    med.name.toLowerCase().includes(query) || 
    med.generic.toLowerCase().includes(query)
  );
  displayMedicines(filtered);
});

// Print Invoice Function
function printBill() {
  if (cart.length === 0) {
    alert("Billing list khali hai!");
    return;
  }
  alert("Bill ready ho gaya hai! Printing invoice...");
}

// Initialize Project
loadMedicineParts();
