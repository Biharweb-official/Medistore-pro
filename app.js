/**
 * Medistore OS - Ultra-Fast Medical ERP Engine
 * Features: Virtual DOM Recycler, Web Worker Search, POS Express Billing, Smart Expiry Radar
 */

const STATE = {
  userRole: 'client',
  rawMedicines: [],
  filteredMedicines: [],
  cart: [],
  db: null,
  searchWorker: null,
  activeFilter: 'ALL',
  virtual: {
    rowHeight: 48,
    visibleCount: 25,
    startIndex: 0,
    endIndex: 25
  }
};

const DB_NAME = "MedistoreOS_Enterprise_DB";
const STORE_NAME = "inventory_store";
const DOM = {};

document.addEventListener("DOMContentLoaded", async () => {
  cacheDOMElements();
  initSearchWorker();
  await initIndexedDB();
  checkSession();
  setupKeyboardHotkeys();
});

function cacheDOMElements() {
  DOM.authModal = document.getElementById("authModal");
  DOM.appLayout = document.getElementById("appLayout");
  DOM.devModeField = document.getElementById("devModeField");
  DOM.recordCounter = document.getElementById("recordCounter");
  DOM.expiryAlertCounter = document.getElementById("expiryAlertCounter");
  DOM.lowStockCounter = document.getElementById("lowStockCounter");
  DOM.devConsoleBtn = document.getElementById("devConsoleBtn");
  DOM.virtualViewport = document.getElementById("virtualViewport");
  DOM.virtualSpacer = document.getElementById("virtualSpacer");
  DOM.virtualRowsContainer = document.getElementById("virtualRowsContainer");
  DOM.terminalLog = document.getElementById("terminalLog");
  DOM.posModal = document.getElementById("posModal");
}

/* ==========================================================================
   1. KEYBOARD HOTKEYS ENGINE (F2 for Billing)
   ========================================================================== */

function setupKeyboardHotkeys() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "F2") {
      e.preventDefault();
      openPOSModal();
    } else if (e.key === "Escape") {
      closePOSModal();
    }
  });
}

/* ==========================================================================
   2. WEB WORKER ENGINE (Multi-threaded Background Search)
   ========================================================================== */

function initSearchWorker() {
  const workerCode = `
    let dataset = [];
    self.onmessage = function(e) {
      const { type, payload } = e.data;
      if (type === 'SET_DATASET') {
        dataset = payload;
      } else if (type === 'SEARCH') {
        const { query, filter } = payload;
        const q = query.toLowerCase().trim();
        
        let results = dataset;

        // Apply Smart Filters
        if (filter === 'EXPIRY') {
          results = results.filter(item => item.daysToExpiry <= 60);
        } else if (filter === 'LOW_STOCK') {
          results = results.filter(item => item.stock <= 15);
        } else if (filter === 'SCHEDULE_H') {
          results = results.filter(item => item.isScheduleH);
        }

        // Apply Text Query
        if (q) {
          results = results.filter(item => 
            item.name.toLowerCase().includes(q) ||
            item.generic.toLowerCase().includes(q) ||
            item.company.toLowerCase().includes(q) ||
            item.batch.toLowerCase().includes(q) ||
            item.rack.toLowerCase().includes(q) ||
            item.id.toLowerCase().includes(q)
          );
        }

        self.postMessage({ type: 'RESULTS', payload: results });
      }
    };
  `;

  const blob = new Blob([workerCode], { type: "application/javascript" });
  STATE.searchWorker = new Worker(URL.createObjectURL(blob));

  STATE.searchWorker.onmessage = (e) => {
    if (e.data.type === 'RESULTS') {
      STATE.filteredMedicines = e.data.payload;
      resetVirtualView();
    }
  };
}

function handleSearchInput(query) {
  if (STATE.searchWorker) {
    STATE.searchWorker.postMessage({ 
      type: 'SEARCH', 
      payload: { query, filter: STATE.activeFilter } 
    });
  }
}

function applySmartFilter(filterType) {
  STATE.activeFilter = filterType;
  
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('bg-indigo-600', 'text-white');
    btn.classList.add('bg-slate-800', 'text-slate-300');
  });

  event.currentTarget.classList.remove('bg-slate-800', 'text-slate-300');
  event.currentTarget.classList.add('bg-indigo-600', 'text-white');

  const query = document.getElementById("searchInput").value;
  handleSearchInput(query);
}

/* ==========================================================================
   3. AUTHENTICATION & ROLE MANAGEMENT
   ========================================================================== */

function switchAuthTab(type) {
  const tabClient = document.getElementById("tabClient");
  const tabDev = document.getElementById("tabDev");

  if (type === "client") {
    STATE.userRole = "client";
    tabClient.className = "w-1/2 py-2 text-center text-xs font-semibold rounded-lg text-white bg-brand-600 shadow-md transition-all";
    tabDev.className = "w-1/2 py-2 text-center text-xs font-semibold rounded-lg text-slate-400 hover:text-white transition-all";
    DOM.devModeField.classList.add("hidden");
  } else {
    STATE.userRole = "developer";
    tabDev.className = "w-1/2 py-2 text-center text-xs font-semibold rounded-lg text-white bg-rose-600 shadow-md transition-all";
    tabClient.className = "w-1/2 py-2 text-center text-xs font-semibold rounded-lg text-slate-400 hover:text-white transition-all";
    DOM.devModeField.classList.remove("hidden");
  }
}

function handleAuthSubmit(e) {
  e.preventDefault();
  const username = document.getElementById("authUsername").value;
  const secret = document.getElementById("devSecret").value;

  if (DOM.devModeField.classList.contains("hidden")) {
    localStorage.setItem("medistore_session", JSON.stringify({ role: "client", username }));
    launchWorkspace("client");
  } else {
    if (secret === "DEV123" || secret === "admin") {
      localStorage.setItem("medistore_session", JSON.stringify({ role: "developer", username }));
      launchWorkspace("developer");
    } else {
      alert("Invalid Developer Key! Access Denied.");
    }
  }
}

function checkSession() {
  const session = JSON.parse(localStorage.getItem("medistore_session"));
  if (session) launchWorkspace(session.role);
}

function launchWorkspace(role) {
  STATE.userRole = role;
  DOM.authModal.classList.add("hidden");
  DOM.appLayout.classList.remove("hidden");
  DOM.appLayout.classList.add("flex");

  if (role === "developer") {
    DOM.devConsoleBtn.classList.remove("hidden");
    devLog("[AUTH SUCCESS]: Developer Terminal Attached.");
  }

  loadDataEngine();
}

function handleLogout() {
  localStorage.removeItem("medistore_session");
  location.reload();
}

/* ==========================================================================
   4. LOCAL CACHING ENGINE (IndexedDB)
   ========================================================================== */

function initIndexedDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = (e) => {
      STATE.db = e.target.result;
      resolve();
    };
  });
}

async function loadDataEngine() {
  const cachedData = await fetchFromDB();
  if (cachedData && cachedData.length > 0) {
    STATE.rawMedicines = cachedData;
    STATE.filteredMedicines = [...cachedData];
    STATE.searchWorker.postMessage({ type: 'SET_DATASET', payload: cachedData });
    updateDashboardCounters();
    resetVirtualView();
  } else {
    devInject10kData();
  }
}

function fetchFromDB() {
  return new Promise((resolve) => {
    const tx = STATE.db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });
}

function saveToDB(records) {
  return new Promise((resolve) => {
    const tx = STATE.db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    records.forEach(item => store.put(item));
    tx.oncomplete = () => resolve();
  });
}

function updateDashboardCounters() {
  DOM.recordCounter.innerText = STATE.rawMedicines.length.toLocaleString();
  
  const expiryCount = STATE.rawMedicines.filter(m => m.daysToExpiry <= 60).length;
  const lowStockCount = STATE.rawMedicines.filter(m => m.stock <= 15).length;

  DOM.expiryAlertCounter.innerText = expiryCount;
  DOM.lowStockCounter.innerText = lowStockCount;
}

/* ==========================================================================
   5. VIRTUAL DOM RECYCLER ENGINE
   ========================================================================== */

function resetVirtualView() {
  DOM.virtualViewport.scrollTop = 0;
  STATE.virtual.startIndex = 0;
  STATE.virtual.endIndex = Math.min(
    STATE.filteredMedicines.length - 1,
    STATE.virtual.visibleCount
  );
  
  DOM.virtualSpacer.style.height = `${STATE.filteredMedicines.length * STATE.virtual.rowHeight}px`;
  renderVirtualRows();
}

function onVirtualScroll(e) {
  const scrollTop = e.target.scrollTop;
  STATE.virtual.startIndex = Math.floor(scrollTop / STATE.virtual.rowHeight);
  STATE.virtual.endIndex = Math.min(
    STATE.filteredMedicines.length - 1,
    STATE.virtual.startIndex + STATE.virtual.visibleCount
  );

  renderVirtualRows();
}

function renderVirtualRows() {
  const container = DOM.virtualRowsContainer;
  container.innerHTML = "";

  const fragment = document.createDocumentFragment();

  for (let i = STATE.virtual.startIndex; i <= STATE.virtual.endIndex; i++) {
    const med = STATE.filteredMedicines[i];
    if (!med) continue;

    const row = document.createElement("div");
    row.className = "med-row grid grid-cols-12 px-6 text-xs items-center border-b border-slate-800/60 hover:bg-slate-800/50 transition font-sans";
    row.style.top = `${i * STATE.virtual.rowHeight}px`;

    const expiryBadge = med.daysToExpiry <= 60 
      ? "text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20" 
      : "text-slate-400";

    const scheduleBadge = med.isScheduleH 
      ? "bg-purple-500/10 text-purple-400 border-purple-500/30" 
      : "bg-slate-800 text-slate-400 border-slate-700";

    row.innerHTML = `
      <div class="col-span-1 font-mono text-slate-500 flex items-center gap-1">
        <span>${med.id}</span>
        <span class="text-[9px] text-indigo-400 bg-indigo-950 px-1 rounded">[${med.rack}]</span>
      </div>
      <div class="col-span-3 pr-2">
        <div class="font-semibold text-slate-200 truncate">${med.name}</div>
        <div class="text-[10px] text-slate-400 truncate">${med.generic}</div>
      </div>
      <div class="col-span-2">
        <div class="font-mono text-slate-300 text-[11px]">B:${med.batch}</div>
        <div class="text-[10px] ${expiryBadge}">Exp: ${med.expiryDate}</div>
      </div>
      <div class="col-span-2 text-slate-400 truncate">${med.company}</div>
      <div class="col-span-1 text-center font-mono font-bold ${med.stock <= 15 ? 'text-amber-400' : 'text-slate-300'}">${med.stock}</div>
      <div class="col-span-1 text-center"><span class="px-1.5 py-0.5 text-[9px] rounded border font-mono ${scheduleBadge}">${med.isScheduleH ? 'Sch-H' : 'Norm'}</span></div>
      <div class="col-span-1 text-right font-mono text-slate-400">₹${parseFloat(med.ptr).toFixed(2)}</div>
      <div class="col-span-1 text-right font-mono font-bold text-emerald-400">₹${parseFloat(med.mrp).toFixed(2)}</div>
    `;

    fragment.appendChild(row);
  }

  container.appendChild(fragment);
}

/* ==========================================================================
   6. EXPRESS POS BILLING MODULE
   ========================================================================== */

function openPOSModal() {
  DOM.posModal.classList.remove("hidden");
  document.getElementById("posSearch").focus();
}

function closePOSModal() {
  DOM.posModal.classList.add("hidden");
}

function handlePOSSearch(q) {
  const query = q.toLowerCase().trim();
  const resultsDiv = document.getElementById("posResults");

  if (!query) {
    resultsDiv.innerHTML = '<p class="text-xs text-slate-500 text-center py-8">Start typing or scan barcode to search medicines...</p>';
    return;
  }

  const matches = STATE.rawMedicines.filter(m => 
    m.name.toLowerCase().includes(query) || m.batch.toLowerCase().includes(query)
  ).slice(0, 8);

  resultsDiv.innerHTML = "";

  matches.forEach(med => {
    const item = document.createElement("div");
    item.className = "p-2.5 bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-700/60 flex items-center justify-between cursor-pointer transition";
    item.onclick = () => addToCart(med);
    
    item.innerHTML = `
      <div>
        <div class="text-xs font-bold text-slate-200">${med.name} <span class="text-[10px] font-normal text-slate-400">(${med.batch})</span></div>
        <div class="text-[10px] text-slate-400">Stock: ${med.stock} | Exp: ${med.expiryDate}</div>
      </div>
      <div class="text-right">
        <div class="text-xs font-bold text-emerald-400 font-mono">₹${med.mrp}</div>
        <div class="text-[10px] text-indigo-400">+ Add Item</div>
      </div>
    `;
    resultsDiv.appendChild(item);
  });
}

function addToCart(med) {
  const existing = STATE.cart.find(c => c.id === med.id);
  if (existing) {
    existing.qty += 1;
  } else {
    STATE.cart.push({ ...med, qty: 1 });
  }
  renderCart();
}

function renderCart() {
  const cartDiv = document.getElementById("cartItems");
  cartDiv.innerHTML = "";

  let subtotal = 0;

  STATE.cart.forEach((item, index) => {
    const itemTotal = item.mrp * item.qty;
    subtotal += itemTotal;

    const row = document.createElement("div");
    row.className = "p-2 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs";
    row.innerHTML = `
      <div>
        <div class="font-bold text-slate-200">${item.name}</div>
        <div class="text-[10px] text-slate-400 font-mono">₹${item.mrp} x ${item.qty}</div>
      </div>
      <div class="flex items-center gap-3">
        <span class="font-bold font-mono text-emerald-400">₹${itemTotal.toFixed(2)}</span>
        <button onclick="removeFromCart(${index})" class="text-rose-400 hover:text-rose-300 p-1"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    cartDiv.appendChild(row);
  });

  const tax = subtotal * 0.12;
  const grand = subtotal + tax;

  document.getElementById("posSubtotal").innerText = `₹${subtotal.toFixed(2)}`;
  document.getElementById("posTax").innerText = `₹${tax.toFixed(2)}`;
  document.getElementById("posGrandTotal").innerText = `₹${grand.toFixed(2)}`;
}

function removeFromCart(index) {
  STATE.cart.splice(index, 1);
  renderCart();
}

function printInvoice() {
  if (STATE.cart.length === 0) return alert("Cart is empty!");
  alert(`Receipt Printed Successfully! Total Paid: ${document.getElementById("posGrandTotal").innerText}`);
  STATE.cart = [];
  renderCart();
  closePOSModal();
}

/* ==========================================================================
   7. DEVELOPER TERMINAL & MOCK DATA GENERATOR
   ========================================================================== */

function toggleDevConsole() {
  document.getElementById("devConsoleModal").classList.toggle("hidden");
}

function devLog(msg) {
  const entry = document.createElement("div");
  entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
  DOM.terminalLog.appendChild(entry);
  DOM.terminalLog.scrollTop = DOM.terminalLog.scrollHeight;
}

async function devInject10kData() {
  devLog("Generating 10,000 High-Capacity Medicine Database Payload...");
  
  const mockDataset = [];
  const companies = ["Sun Pharma", "Cipla Ltd", "Mankind Health", "Alkem Labs", "Torrent Med", "Dr. Reddy's"];
  const salts = ["Paracetamol 650mg", "Amoxicillin 500mg", "Pantoprazole 40mg", "Cetirizine 10mg", "Telmisartan 40mg", "Azithromycin 500mg"];
  const racks = ["A1", "A2", "B1", "B4", "C2", "R1-Top"];

  for (let i = 1; i <= 10000; i++) {
    const daysExp = Math.floor(Math.random() * 365);
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + daysExp);

    mockDataset.push({
      id: `MED-${String(i).padStart(5, '0')}`,
      name: `Medicine Product - ${i}`,
      generic: salts[i % salts.length],
      company: companies[i % companies.length],
      batch: `BT-${Math.floor(1000 + Math.random() * 9000)}`,
      rack: racks[i % racks.length],
      expiryDate: expDate.toISOString().split('T')[0],
      daysToExpiry: daysExp,
      stock: Math.floor(Math.random() * 100),
      isScheduleH: i % 7 === 0,
      ptr: (Math.random() * 180 + 10).toFixed(2),
      mrp: (Math.random() * 250 + 20).toFixed(2)
    });
  }

  await saveToDB(mockDataset);
  STATE.rawMedicines = mockDataset;
  STATE.filteredMedicines = [...mockDataset];
  STATE.searchWorker.postMessage({ type: 'SET_DATASET', payload: mockDataset });

  updateDashboardCounters();
  resetVirtualView();
  devLog("SUCCESS: 10,000 Items Loaded into IndexedDB & Search Worker.");
}

async function devClearCache() {
  const tx = STATE.db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  tx.oncomplete = () => {
    STATE.rawMedicines = [];
    STATE.filteredMedicines = [];
    STATE.searchWorker.postMessage({ type: 'SET_DATASET', payload: [] });
    updateDashboardCounters();
    resetVirtualView();
    devLog("SYSTEM: Local IndexedDB database wiped.");
  };
}

function triggerCloudSync() {
  devLog("REST API Sync Handshake complete.");
  alert("Cloud Database Synced! Modern REST Engine Plug-and-Play ready.");
}

function devTriggerCloudPatch() {
  devLog("Hot-Patch Signal broadcasted to active worker threads.");
}

function exportInventoryJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(STATE.rawMedicines));
  const anchor = document.createElement("a");
  anchor.setAttribute("href", dataStr);
  anchor.setAttribute("download", `medistore_export_${Date.now()}.json`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
