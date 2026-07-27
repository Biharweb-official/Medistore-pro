let allMedicines = [];
let cart = [];

// Keyboard Shortcuts (F3: Search, F2: Clear)
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

// JSON Parts Loader
async function loadMedicineParts() {
  const totalParts = 1; // Jaise naye JSON parts banenge, counts badha sakte hain

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

// Display Stock Grid with Complete Details
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
        <div class="card-header">
          <h4>${med.name}</h4>
          <span class="type-tag ${med.type.toLowerCase()}">${med.type}</span>
        </div>
        <p><b>Company:</b> ${med.company}</p>
        <p><b>Generic:</b> ${med.generic}</p>
        
        <div class="batch-info">
          <span><b>Batch:</b> ${med.batch_no}</span>
          <span><b>Exp:</b> ${med.expiry}</span>
        </div>

        <div class="price-row">
          <span class="ptr">PTR: ₹${med.ptr}</span>
          <span class="mrp">MRP: ₹${med.mrp}</span>
        </div>

        <button class="btn-add" onclick="addToCart('${med.id}')">+ Add to Bill</button>
      </div>
    `;
    container.innerHTML += card;
  });
}

// POS Billing Counter Logics
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
        <div>
          <b>${item.name}</b><br>
          <small>Batch: ${item.batch_no} | Exp: ${item.expiry}</small>
        </div>
        <strong>₹${item.mrp}</strong>
      </div>
    `;
  });

  cartTotal.innerText = `₹${total.toFixed(2)}`;
}

// Fast Search System (Name, Generic, Company, Batch)
document.getElementById('searchInput').addEventListener('keyup', (e) => {
  const query = e.target.value.toLowerCase().trim();
  const filtered = allMedicines.filter(med => 
    med.name.toLowerCase().includes(query) || 
    med.generic.toLowerCase().includes(query) ||
    med.company.toLowerCase().includes(query) ||
    med.batch_no.toLowerCase().includes(query)
  );
  displayMedicines(filtered);
});

// Print Invoice
function printBill() {
  if (cart.length === 0) {
    alert("Billing list khali hai!");
    return;
  }
  alert("Bill ready! Generating GST Invoice...");
}

// App Launch
loadMedicineParts();
