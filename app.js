let allMedicines = [];

// Data Fetching Function (Part-by-Part JSON Reader)
async function loadMedicines() {
  const totalParts = 1; // Jaise naye JSON parts banenge, count 2, 3, 4 badha sakte hain

  for (let i = 1; i <= totalParts; i++) {
    try {
      const res = await fetch(`./data/medicines_part${i}.json`);
      const data = await res.json();
      allMedicines = [...allMedicines, ...data];
      displayMedicines(allMedicines);
    } catch (error) {
      console.error(`Part ${i} load nahi ho saka:`, error);
    }
  }
}

// Display Medicines in Cards
function displayMedicines(list) {
  const container = document.getElementById('medicineList');
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center;">Koi medicine nahi mili.</p>';
    return;
  }

  // Display top 50 items for fast rendering
  list.slice(0, 50).forEach(med => {
    const card = `
      <div class="card">
        <h4>${med.name}</h4>
        <p><b>Generic:</b> ${med.generic}</p>
        <p><b>Category:</b> ${med.category}</p>
        <p class="price">MRP: ₹${med.mrp}</p>
      </div>
    `;
    container.innerHTML += card;
  });
}

// Search Filter
document.getElementById('searchInput').addEventListener('keyup', (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allMedicines.filter(med => 
    med.name.toLowerCase().includes(query) || 
    med.generic.toLowerCase().includes(query)
  );
  displayMedicines(filtered);
});

// App Start
loadMedicines();
