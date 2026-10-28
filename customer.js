// =========================================================
// CAFE CUSTOMER WEBSITE
// Menu + Cart + Google Sheets + WhatsApp Orders + Mobile UI
// =========================================================

// IMPORTANT: Use the deployed Public Order API /exec URL.
const PUBLIC_API_URL = "https://script.google.com/macros/s/AKfycbwNHW-tTYHHU-5VzeP79vHyi_drZ5YWCB-vUYsk9QBZ29OnH_ivxolo35V75xHzbdnXvg/exec";

const FALLBACK_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS7YCQ9CGlKGS8y9UVUPW_8nRyqvGByCbjpGVim1VtJ7VUgsQItghADB4WZU3p9nmQwP_6Ofj6yRAf5/pub?gid=1147272507&single=true&output=csv";

let SHEET_URL = FALLBACK_SHEET_URL;

let PUBLIC_CONFIG = {
  cafeName: "Your Cafe",
  cafeLogoUrl: "",
  cafeAddress: "",
  cafePhone: "",
  menuCsvUrl: "",
  gstPercent: 5
};

let menuItems = [];
let selectedCategory = "All";

// Item ID => quantity
const cart = new Map();

const categoryContainer = document.getElementById("Mcatogery");
const menuContainer = document.getElementById("Mitems");
const searchInput = document.getElementById("searchitem");
const cartContainer = document.getElementById("cart");
const placeOrderButton = document.getElementById("placeorder");


// =========================================================
// PUBLIC CONFIGURATION
// =========================================================

function fetchPublicConfig() {
  const apiUrl = String(PUBLIC_API_URL || "").trim();

  if (!apiUrl || apiUrl.includes("PASTE_PUBLIC_ORDER_API_URL_HERE")) {
    return Promise.reject(
      new Error("Public order API URL has not been configured.")
    );
  }

  return new Promise((resolve, reject) => {
    const callbackName =
      "cafeConfig_" +
      Date.now() +
      "_" +
      Math.floor(Math.random() * 100000);

    const script = document.createElement("script");
    const separator = apiUrl.includes("?") ? "&" : "?";

    let finished = false;
    let timeoutId;

    const cleanup = () => {
      if (finished) return;

      finished = true;
      clearTimeout(timeoutId);
      script.remove();

      try {
        delete window[callbackName];
      } catch (_) {
        window[callbackName] = undefined;
      }
    };

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Cafe settings request timed out."));
    }, 12000);

    window[callbackName] = (config) => {
      cleanup();

      if (!config || typeof config !== "object") {
        reject(new Error("Invalid public cafe configuration."));
        return;
      }

      resolve(config);
    };

    script.onerror = () => {
      cleanup();

      reject(
        new Error(
          "Could not load cafe settings. Check the public Order API URL."
        )
      );
    };

    script.src =
      apiUrl +
      separator +
      "callback=" +
      encodeURIComponent(callbackName);

    document.head.appendChild(script);
  });
}


function applyPublicCafeSettings(config) {
  PUBLIC_CONFIG = {
    ...PUBLIC_CONFIG,
    ...(config || {})
  };

  if (PUBLIC_CONFIG.menuCsvUrl) {
    SHEET_URL = PUBLIC_CONFIG.menuCsvUrl;
  }

  const cafeName = String(
    PUBLIC_CONFIG.cafeName || "Your Cafe"
  ).trim();

  const cafeNameHeading = document.querySelector("#cafe-name h1");
  const footerCafeName = document.querySelector("#cafedet h1");

  if (cafeNameHeading) {
    cafeNameHeading.textContent = cafeName;
  }

  if (footerCafeName) {
    footerCafeName.textContent = cafeName;
  }

  // =========================================
// DYNAMIC PAGE TITLE + FAVICON
// Uses cafe settings from the admin panel
// =========================================

// Browser tab title
document.title = "Order Now || " + cafeName;

// Cafe logo URL saved in Cafe Settings
const faviconUrl = String(
  PUBLIC_CONFIG.cafeLogoUrl || ""
).trim();

// Find existing favicon link in customer.html
let favicon = document.querySelector(
  'link[rel~="icon"]'
);

// Create favicon link if customer.html has none
if (!favicon) {
  favicon = document.createElement("link");
  favicon.rel = "icon";
  document.head.appendChild(favicon);
}

// Set cafe logo as browser tab icon
if (faviconUrl) {
  favicon.href = faviconUrl;
  favicon.type = "";
  favicon.removeAttribute("sizes");
}

  const addressText = document.querySelector("#add p");

  if (addressText && PUBLIC_CONFIG.cafeAddress) {
    addressText.textContent = PUBLIC_CONFIG.cafeAddress;
  }

  const phoneText = document.querySelector("#phone p");

  if (phoneText && PUBLIC_CONFIG.cafePhone) {
    phoneText.textContent = PUBLIC_CONFIG.cafePhone;
  }

  // Update cafe logo if a logo URL is configured.
  const logoContainer = document.getElementById("cafe-logo");
  const logoUrl = String(
    PUBLIC_CONFIG.cafeLogoUrl || ""
  ).trim();

  if (logoContainer && logoUrl) {
    const image = document.createElement("img");

    image.src = logoUrl;
    image.alt = cafeName + " logo";
    image.width = 32;
    image.height = 32;

    image.style.width = "2rem";
    image.style.height = "2rem";
    image.style.objectFit = "cover";
    image.style.borderRadius = "50%";

    image.onerror = () => {
      image.remove();
    };

    logoContainer.replaceChildren(image);
  }

  // Update GST notice.
  const gstPercent = Number(PUBLIC_CONFIG.gstPercent);
  const gstNoteElement = document.getElementById("gst-note");

  if (gstNoteElement && Number.isFinite(gstPercent)) {
    gstNoteElement.textContent =
      "GST " + gstPercent + "% applicable";
  }
}


async function initialiseCustomerPage() {
  try {
    const config = await fetchPublicConfig();
    applyPublicCafeSettings(config);
  } catch (error) {
    console.warn(
      "Cafe public config unavailable; using fallback settings.",
      error
    );
  }

  await loadMenu();
}


// =========================================================
// CSV PARSER
// =========================================================

function parseCSV(csv) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(value.trim());
      value = "";
    } else if (
      (char === "\n" || char === "\r") &&
      !insideQuotes
    ) {
      if (char === "\r" && next === "\n") {
        i++;
      }

      row.push(value.trim());

      if (row.some(cell => cell !== "")) {
        rows.push(row);
      }

      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value !== "" || row.length > 0) {
    row.push(value.trim());

    if (row.some(cell => cell !== "")) {
      rows.push(row);
    }
  }

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map(header =>
    header.trim().toLowerCase()
  );

  return rows.slice(1).map(values => {
    const item = {};

    headers.forEach((header, index) => {
      item[header] = values[index] ?? "";
    });

    return item;
  });
}


// =========================================================
// HELPER FUNCTIONS
// =========================================================

function formatPrice(price) {
  return Number(price).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });
}


function createElement(tag, className, text = "") {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== "") {
    element.textContent = text;
  }

  return element;
}


// =========================================================
// LOAD MENU FROM GOOGLE SHEETS
// =========================================================

async function loadMenu() {
  const menuList = getMenuList();

  menuList.replaceChildren(
    createElement("p", "menu-message", "Loading menu...")
  );

  if (!SHEET_URL) {
    menuList.replaceChildren(
      createElement(
        "p",
        "menu-message",
        "Cafe menu is not configured yet. The owner must save the published Menu CSV URL in the cafe admin panel."
      )
    );

    renderCategories();
    renderCart();
    return;
  }

  try {
    const response = await fetch(
  SHEET_URL +
    (SHEET_URL.includes("?") ? "&" : "?") +
    "_t=" + Date.now(),
  { cache: "no-store" }
);
//const response = await fetch(SHEET_URL);// ye jaruat padne pe upar wale code ko replae krke 
    if (!response.ok) {
      throw new Error("Could not load the menu sheet.");
    }

    const csv = await response.text();

    menuItems = parseCSV(csv)
      .map((item, index) => {
        const price = Number(item.price);

        return {
          id: String(item.id || index + 1).trim(),
          category: String(
            item.category || "Other"
          ).trim(),
          name: String(item.name || "").trim(),
          price,

          availability:
  String(item.availability || 'Yes').trim().toLowerCase() === 'no'
    ? 'No'
    : 'Yes',

          validPrice:
            item.price.trim() !== "" &&
            Number.isFinite(price) &&
            price >= 0
        };
      })
      .filter(item => item.name && item.validPrice);

    if (menuItems.length === 0) {
      menuList.replaceChildren(
        createElement(
          "p",
          "menu-message",
          "No menu items found. Check your Google Sheet headers: id, category, name, price."
        )
      );

      renderCategories();
      renderCart();
      return;
    }

    renderCategories();
    renderMenu();
    renderCart();

  } catch (error) {
    console.error(error);

    menuList.replaceChildren(
      createElement(
        "p",
        "menu-message",
        "Menu load nahi hua. Internet aur published Google Sheet URL check karo."
      )
    );
  }
}


// Keep existing menu heading and search bar.
function getMenuList() {
  let list = menuContainer.querySelector(".menu-list");

  if (!list) {
    list = createElement("div", "menu-list");
    searchInput.insertAdjacentElement("afterend", list);
  }

  return list;
}


// =========================================================
// CATEGORY BUTTONS
// =========================================================

function renderCategories() {
  let list = categoryContainer.querySelector(".category-list");

  if (!list) {
    list = createElement("div", "category-list");
    categoryContainer.appendChild(list);
  }

  list.replaceChildren();

  const categories = [
    "All",
    ...new Set(menuItems.map(item => item.category))
  ];

  categories.forEach(category => {
    const button = createElement(
      "button",
      "category-btn",
      category
    );

    button.type = "button";

    if (selectedCategory === category) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      selectedCategory = category;
      renderCategories();
      renderMenu();
    });

    list.appendChild(button);
  });
}


// =========================================================
// RENDER MENU CARDS
// =========================================================

function renderMenu() {
  const list = getMenuList();
  list.replaceChildren();

  const searchText = searchInput.value
    .trim()
    .toLowerCase();

  const filtered = menuItems.filter(item => {
    const matchesCategory =
      selectedCategory === "All" ||
      item.category === selectedCategory;

    const matchesSearch =
      item.name.toLowerCase().includes(searchText) ||
      item.category.toLowerCase().includes(searchText);

    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    list.appendChild(
      createElement("p", "menu-message", "No dishes found.")
    );

    return;
  }

  filtered.forEach(item => {
    const card = createElement("div", "menu-item");
     const isOutOfStock = item.availability === 'No';

if (isOutOfStock) {
  card.classList.add('out-of-stock');
}

    const name = createElement(
      "h3",
      "menu-item-name",
      item.name
    );

    const bottom = createElement(
      "div",
      "menu-item-bottom"
    );

    const price = createElement(
      "p",
      "menu-item-price",
      `₹${formatPrice(item.price)}`
    );

    const addButton = createElement(
      "button",
      "add-to-cart",
      cart.has(item.id) ? "Add More +" : "Add +"
    );

    addButton.type = "button";
    if (isOutOfStock) {
  addButton.disabled = true;
  addButton.textContent = 'Out of Stock';
  addButton.setAttribute('aria-label', item.name + ' is out of stock');
}

    addButton.addEventListener("click", () => {
  if (item.availability === 'No') return;
  addToCart(item.id);
});

    bottom.append(price, addButton);
    card.append(name, bottom);
    list.appendChild(card);
  });
}


// =========================================================
// CART FUNCTIONS
// =========================================================

function addToCart(id) {
  const quantity = cart.get(id) || 0;

  cart.set(id, quantity + 1);

  renderCart();
  renderMenu();
}


function changeQuantity(id, change) {
  const quantity = cart.get(id) || 0;
  const newQuantity = quantity + change;

  if (newQuantity <= 0) {
    cart.delete(id);
  } else {
    cart.set(id, newQuantity);
  }

  renderCart();
  renderMenu();
}


function removeFromCart(id) {
  cart.delete(id);

  renderCart();
  renderMenu();
}


// =========================================================
// RENDER CART
// =========================================================

function renderCart() {
  let cartItems = cartContainer.querySelector(".cart-items");
  let totalElement = cartContainer.querySelector(".cart-total");

  if (!cartItems) {
    cartItems = createElement("div", "cart-items");

    placeOrderButton.insertAdjacentElement(
      "beforebegin",
      cartItems
    );
  }

  if (!totalElement) {
    totalElement = createElement("div", "cart-total");

    placeOrderButton.insertAdjacentElement(
      "beforebegin",
      totalElement
    );
  }

  cartItems.replaceChildren();

  let total = 0;
  let totalQuantity = 0;

  cart.forEach((quantity, id) => {
    const item = menuItems.find(
      menuItem => menuItem.id === id
    );

    if (!item) return;

    total += item.price * quantity;
    totalQuantity += quantity;

    const row = createElement("div", "cart-item");

    const info = createElement("div", "cart-item-info");

    const name = createElement("h4", "", item.name);

    const linePrice = createElement(
      "p",
      "cart-line-price",
      `₹${formatPrice(item.price * quantity)}`
    );

    info.append(name, linePrice);

    const controls = createElement(
      "div",
      "cart-item-controls"
    );

    const minusButton = createElement(
      "button",
      "qty-btn",
      "−"
    );

    minusButton.type = "button";
    minusButton.setAttribute(
      "aria-label",
      `Decrease ${item.name}`
    );

    minusButton.addEventListener("click", () => {
      changeQuantity(id, -1);
    });

    const quantityText = createElement(
      "span",
      "cart-quantity",
      String(quantity)
    );

    const plusButton = createElement(
      "button",
      "qty-btn",
      "+"
    );

    plusButton.type = "button";
    plusButton.setAttribute(
      "aria-label",
      `Increase ${item.name}`
    );

    plusButton.addEventListener("click", () => {
      changeQuantity(id, 1);
    });

    controls.append(
      minusButton,
      quantityText,
      plusButton
    );

    const removeButton = createElement(
      "button",
      "remove-item",
      "Remove"
    );

    removeButton.type = "button";

    removeButton.addEventListener("click", () => {
      removeFromCart(id);
    });

    row.append(info, controls, removeButton);
    cartItems.appendChild(row);
  });

  if (cart.size === 0) {
    cartItems.appendChild(
      createElement(
        "p",
        "cart-empty",
        "Your cart is empty."
      )
    );
  }

  totalElement.replaceChildren();

  const totalLabel = createElement(
    "span",
    "",
    `Total (${totalQuantity} item${totalQuantity === 1 ? "" : "s"})`
  );

  const totalPrice = createElement(
    "strong",
    "",
    `₹${formatPrice(total)}`
  );

  totalElement.append(totalLabel, totalPrice);

  placeOrderButton.disabled = cart.size === 0;

  placeGstNote();
}


// =========================================================
// ORDER TYPE: DELIVERY OR TABLE
// =========================================================

// QR URLs:
// ?orderType=delivery
// ?orderType=table&table=5
//
// Normal URL defaults to table mode.

const customerPageParams = new URLSearchParams(
  window.location.search
);

const requestedOrderType = (
  customerPageParams.get("orderType") ||
  customerPageParams.get("mode") ||
  "table"
).trim().toLowerCase();

const orderType =
  requestedOrderType === "delivery" ? "delivery" : "table";

const orderTableNumber = (
  customerPageParams.get("table") || ""
).trim();

const orderModal = document.getElementById("orderModal");
const closeOrderModalButton =
  document.getElementById("closeOrderModal");

const customerOrderForm =
  document.getElementById("customerOrderForm");

const customerNameInput =
  document.getElementById("customerName");

const customerPhoneInput =
  document.getElementById("customerPhone");

const customerAddressField =
  document.getElementById("customerAddressField");

const customerAddressInput =
  document.getElementById("customerAddress");

const orderModeDescription =
  document.getElementById("orderModeDescription");

const gstNote = document.getElementById("gst-note");

let customerNotesInput = null;


// =========================================================
// DYNAMIC ORDER NOTES FIELD
// =========================================================

function ensureCustomerNotesField() {
  if (!customerOrderForm) return null;

  const existingInput = document.getElementById("customerOrderNotes");

  if (existingInput) {
    customerNotesInput = existingInput;
    return customerNotesInput;
  }

  const field = document.createElement("div");
  field.id = "customerOrderNotesField";
  field.className = "customer-notes-field";
  field.style.marginTop = "12px";
  field.style.width = "100%";

  const label = document.createElement("label");
  label.htmlFor = "customerOrderNotes";
  label.textContent = "Order notes (optional)";
  label.style.display = "block";
  label.style.marginBottom = "6px";
  label.style.fontWeight = "600";

  const textarea = document.createElement("textarea");
  textarea.id = "customerOrderNotes";
  textarea.name = "orderNotes";
  textarea.rows = 3;
  textarea.maxLength = 500;
  textarea.placeholder =
    "Example: extra spicy, less sugar, no onion, sauce on the side...";
  textarea.setAttribute("aria-label", "Optional order notes");

  textarea.style.display = "block";
  textarea.style.width = "100%";
  textarea.style.minHeight = "84px";
  textarea.style.boxSizing = "border-box";
  textarea.style.resize = "vertical";
  textarea.style.padding = "10px 12px";
  textarea.style.border = "1px solid rgba(128,128,128,0.55)";
  textarea.style.borderRadius = "8px";
  textarea.style.background = "transparent";
  textarea.style.color = "inherit";
  textarea.style.font = "inherit";

  const hint = document.createElement("small");
  hint.textContent =
    "Add preferences for the cafe, e.g. spicy or less sugar.";
  hint.style.display = "block";
  hint.style.marginTop = "5px";
  hint.style.opacity = "0.75";

  field.append(label, textarea, hint);

  const submitButton = customerOrderForm.querySelector(
    "#confirmWhatsAppOrder, button[type='submit'], input[type='submit']"
  );

  const actionRow = submitButton
    ? submitButton.closest(
        ".form-actions, .modal-actions, .order-form-actions"
      )
    : null;

  if (actionRow && actionRow.parentElement === customerOrderForm) {
    customerOrderForm.insertBefore(field, actionRow);
  } else if (
    submitButton &&
    submitButton.parentElement &&
    submitButton.parentElement !== customerOrderForm &&
    submitButton.parentElement.parentElement === customerOrderForm
  ) {
    customerOrderForm.insertBefore(field, submitButton.parentElement);
  } else if (
    customerAddressField &&
    customerAddressField.parentElement
  ) {
    customerAddressField.insertAdjacentElement("afterend", field);
  } else if (submitButton && submitButton.parentElement) {
    submitButton.parentElement.insertBefore(field, submitButton);
  } else {
    customerOrderForm.appendChild(field);
  }

  customerNotesInput = textarea;
  return customerNotesInput;
}


// =========================================================
// CONFIGURE DELIVERY / TABLE POPUP
// =========================================================

function configureCustomerOrderMode() {
  const isDeliveryOrder = orderType === "delivery";

  ensureCustomerNotesField();

  if (customerAddressField) {
    customerAddressField.hidden = !isDeliveryOrder;
  }

  if (customerAddressInput) {
    customerAddressInput.required = isDeliveryOrder;
    customerAddressInput.disabled = !isDeliveryOrder;
    customerAddressInput.value = "";
  }

  if (customerNotesInput) {
    customerNotesInput.value = "";
  }

  if (orderModeDescription) {
    orderModeDescription.textContent = isDeliveryOrder
      ? "Delivery order: enter your name, phone number and delivery address. Add any food preferences in notes."
      : "Table order: enter your name and phone number. Add any food preferences in notes.";
  }

  document.body.dataset.orderType = orderType;
}


function openOrderModal() {
  if (cart.size === 0) {
    alert("Please add an item to your cart first.");
    return;
  }

  configureCustomerOrderMode();

  orderModal?.classList.add("is-open");
  orderModal?.setAttribute("aria-hidden", "false");

  customerNameInput?.focus();
}


function closeOrderModal() {
  orderModal?.classList.remove("is-open");
  orderModal?.setAttribute("aria-hidden", "true");

  placeOrderButton?.focus();
}


// Keep GST note immediately above Place Order.
function placeGstNote() {
  if (gstNote && placeOrderButton) {
    placeOrderButton.insertAdjacentElement(
      "beforebegin",
      gstNote
    );
  }
}


configureCustomerOrderMode();
placeGstNote();

placeOrderButton.addEventListener(
  "click",
  openOrderModal
);

closeOrderModalButton?.addEventListener(
  "click",
  closeOrderModal
);

orderModal?.addEventListener("click", (event) => {
  if (event.target === orderModal) {
    closeOrderModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    orderModal?.classList.contains("is-open")
  ) {
    closeOrderModal();
  }
});


// =========================================================
// SEND ORDER TO THE PUBLIC API
// =========================================================

function postOrderToAppsScript(payload) {
  const apiUrl = String(PUBLIC_API_URL || "").trim();

  if (
    !apiUrl ||
    apiUrl.includes("PASTE_PUBLIC_ORDER_API_URL_HERE")
  ) {
    return Promise.reject(
      new Error("Public Order API URL is missing.")
    );
  }

  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");

    const frameName =
      "cafeOrderFrame_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2);

    frame.name = frameName;
    frame.title = "Order submission";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;

    Object.assign(frame.style, {
      position: "fixed",
      width: "1px",
      height: "1px",
      opacity: "0",
      left: "-10000px",
      pointerEvents: "none"
    });

    const form = document.createElement("form");
    form.method = "POST";
    form.action = apiUrl;
    form.target = frameName;
    form.enctype = "application/x-www-form-urlencoded";
    form.style.display = "none";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(payload);

    form.appendChild(input);

    let settled = false;
    let timeoutId;

    function finish(callback, value) {
      if (settled) return;

      settled = true;
      clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);

      form.remove();
      frame.remove();

      callback(value);
    }

    function onMessage(event) {
      const data = event.data;

      // Match only the response for this submission.
      // Apps Script responses can arrive from a nested frame.
      if (
        !data ||
        data.type !== "cafe-order-result" ||
        typeof data.ok !== "boolean" ||
        !payload.requestId ||
        data.requestId !== payload.requestId
      ) {
        return;
      }

      if (data.ok) {
        finish(resolve, data);
      } else {
        finish(
          reject,
          new Error(
            data.error || "Could not save the order."
          )
        );
      }
    }

    timeoutId = setTimeout(() => {
      finish(
        reject,
        new Error(
          "Order save response timed out. Check the Orders sheet before retrying."
        )
      );
    }, 25000);

    window.addEventListener("message", onMessage);

    document.body.appendChild(frame);
    document.body.appendChild(form);

    form.submit();
  });
}


// =========================================================
// CONFIRM ORDER
// Save first, then open WhatsApp
// =========================================================

customerOrderForm?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (cart.size === 0) {
      closeOrderModal();
      alert("Your cart is empty. Please add an item first.");
      return;
    }

    const customerName = customerNameInput.value.trim();
    const customerPhone = customerPhoneInput.value.trim();
    const customerAddress = customerAddressInput.value.trim();
    if (!/^[6-9]\d{9}$/.test(customerPhone)) {
    alert("Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.");
    customerPhoneInput.focus();
    return;
}

    const orderNotes = String(
      ensureCustomerNotesField()?.value || ""
    ).trim().slice(0, 500);

    const isDeliveryOrder = orderType === "delivery";

    if (!customerName) {
      customerNameInput.focus();
      customerNameInput.reportValidity();
      return;
    }

    if (isDeliveryOrder && !customerAddress) {
      customerAddressInput.required = true;
      customerAddressInput.focus();
      customerAddressInput.reportValidity();
      return;
    }

    const phoneElement = document.querySelector("#phone p");

    const cafePhoneSource =
      PUBLIC_CONFIG.cafePhone ||
      (phoneElement && phoneElement.textContent) ||
      "";

    let cafePhone = String(cafePhoneSource).replace(/\D/g, "");

    if (cafePhone.length === 10) {
      cafePhone = "91" + cafePhone;
    }

    if (!/^\d{11,15}$/.test(cafePhone)) {
      alert("Cafe ka valid WhatsApp number check karo.");
      return;
    }

    const orderItems = Array.from(cart.entries()).map(
      ([id, quantity]) => ({
        id: String(id),
        quantity: Number(quantity)
      })
    );

    if (!orderItems.length) {
      alert("Your cart is empty. Please add an item first.");
      return;
    }

    const requestId =
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : "req-" +
          Date.now() +
          "-" +
          Math.random().toString(36).slice(2, 12);

    const payload = {
      requestId,
      customerName,
      customerPhone,
      orderType,

      deliveryAddress: isDeliveryOrder
        ? customerAddress
        : "",

      tableNumber: orderTableNumber,
      orderNotes,
      items: orderItems,
      website: ""
    };

    // Open a blank tab during the click to reduce popup blocking.
    const whatsappWindow = window.open("about:blank", "_blank");

    if (!whatsappWindow) {
      alert(
        "Please allow pop-ups for this cafe website, then confirm the order again."
      );
      return;
    }

    const confirmButton = document.getElementById(
      "confirmWhatsAppOrder"
    );

    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.textContent = "Saving order…";
    }

    try {
      // Wait for the API to confirm that the order was saved.
      const result = await postOrderToAppsScript(payload);

      const lines = [
        "Hello! I want to place an order.",
        "",
        "Order ID: " + result.orderId,
        "Order Type: " +
          (isDeliveryOrder ? "Delivery" : "Table"),
        "Customer Name: " + customerName
      ];

      if (customerPhone) {
        lines.push("Customer Phone: " + customerPhone);
      }

      if (isDeliveryOrder) {
        lines.push("Delivery Address: " + customerAddress);
      }

      if (!isDeliveryOrder && orderTableNumber) {
        lines.push("Table Number: " + orderTableNumber);
      }

      if (orderNotes) {
        lines.push("Order Notes: " + orderNotes);
      }

      lines.push("", "ORDER DETAILS:");

      (result.items || []).forEach(item => {
        lines.push(
          item.name +
          " x " +
          item.quantity +
          " = ₹" +
          formatPrice(item.lineTotal)
        );
      });

      lines.push("");
      lines.push(
        "Subtotal: ₹" + formatPrice(result.subtotal)
      );

      lines.push(
        "GST (" +
        formatPrice(result.gstPercent) +
        "%): ₹" +
        formatPrice(result.gstAmount)
      );

      lines.push(
        "Total: ₹" + formatPrice(result.total)
      );

      lines.push("");
      lines.push("Please confirm my order.");

      const whatsappURL =
        "https://wa.me/" +
        cafePhone +
        "?text=" +
        encodeURIComponent(lines.join("\n"));

      whatsappWindow.opener = null;
      whatsappWindow.location.href = whatsappURL;

      closeOrderModal();
      customerOrderForm.reset();
      configureCustomerOrderMode();

      console.info(
        "Order saved before WhatsApp redirect:",
        result.orderId
      );

    } catch (error) {
      console.error(error);

      try {
        whatsappWindow.close();
      } catch (_) {}

      alert(
        (error && error.message) ||
        "Order save nahi hua. Please try again."
      );

    } finally {
      if (confirmButton) {
        confirmButton.disabled = false;

        confirmButton.innerHTML =
          '<i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Confirm Order on WhatsApp';
      }
    }
  }
);


// =========================================================
// SEARCH DISHES
// =========================================================

searchInput.addEventListener("input", renderMenu);


// Start: load owner-configured settings and menu.
initialiseCustomerPage();


// =========================================================
// MOBILE CATEGORY DRAWER + CART VIEW
// =========================================================

const mobileBody = document.body;

const mobileCategoryToggle =
  document.getElementById("mobilecategorytoggle");

const mobileCartToggle =
  document.getElementById("mobilecarttoggle");

const mobileCategoryClose =
  document.getElementById("mobilecategoryclose");

const mobileCartBack =
  document.getElementById("mobilecartback");

const mobileBackdrop =
  document.getElementById("mobileviewbackdrop");

const mobilePlaceOrder =
  document.getElementById("mobileplaceorder");


const isMobileLayout = () =>
  window.matchMedia("(max-width: 600px)").matches;


function closeMobilePanels() {
  mobileBody.classList.remove(
    "mobile-categories-open",
    "mobile-cart-open"
  );

  mobileCategoryToggle?.setAttribute(
    "aria-expanded",
    "false"
  );

  mobileCartToggle?.setAttribute(
    "aria-expanded",
    "false"
  );
}


function openMobileCategories() {
  if (!isMobileLayout()) return;

  mobileBody.classList.remove("mobile-cart-open");

  const shouldOpen =
    !mobileBody.classList.contains("mobile-categories-open");

  mobileBody.classList.toggle(
    "mobile-categories-open",
    shouldOpen
  );

  mobileCategoryToggle?.setAttribute(
    "aria-expanded",
    String(shouldOpen)
  );

  mobileCartToggle?.setAttribute(
    "aria-expanded",
    "false"
  );
}


function openMobileCart() {
  if (!isMobileLayout()) return;

  mobileBody.classList.remove("mobile-categories-open");
  mobileBody.classList.add("mobile-cart-open");

  mobileCategoryToggle?.setAttribute(
    "aria-expanded",
    "false"
  );

  mobileCartToggle?.setAttribute(
    "aria-expanded",
    "true"
  );
}


mobileCategoryToggle?.addEventListener(
  "click",
  openMobileCategories
);


mobileCartToggle?.addEventListener("click", () => {
  if (!isMobileLayout()) return;

  if (mobileBody.classList.contains("mobile-cart-open")) {
    closeMobilePanels();
  } else {
    openMobileCart();
  }
});


mobileCategoryClose?.addEventListener(
  "click",
  closeMobilePanels
);

mobileCartBack?.addEventListener(
  "click",
  closeMobilePanels
);

mobileBackdrop?.addEventListener(
  "click",
  closeMobilePanels
);


// Bottom CTA opens cart view.
mobilePlaceOrder?.addEventListener(
  "click",
  openMobileCart
);


// Category buttons are rendered dynamically.
document.addEventListener("click", (event) => {
  const clickedCategory = event.target.closest(".category-btn");

  if (clickedCategory && isMobileLayout()) {
    closeMobilePanels();
  }
});


document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMobilePanels();
  }
});


// =========================================================
// MOBILE HEADER: LONG CAFE NAME HANDLING
// =========================================================

const mobileCafeHeader =
  document.getElementById("cafedetails");

const mobileCafeBrand =
  document.getElementById("cafenamelogo");

const mobileCafeLogo =
  document.getElementById("cafe-logo");

const mobileCafeName =
  document.getElementById("cafe-name");

const mobileCafeTitle =
  mobileCafeName?.querySelector("h1");


function fitMobileCafeBrand() {
  if (
    !mobileCafeHeader ||
    !mobileCafeBrand ||
    !mobileCafeLogo ||
    !mobileCafeName ||
    !mobileCafeTitle
  ) {
    return;
  }

  const root = document.documentElement;
  const rootStyles = getComputedStyle(root);

  const baseHeaderHeight =
    parseFloat(
      rootStyles.getPropertyValue(
        "--mobile-header-base-height"
      )
    ) || 62;

  if (!isMobileLayout()) {
    mobileCafeHeader.classList.remove(
      "mobile-brand-wrapped"
    );

    mobileCafeName.style.fontSize = "";
    mobileCafeLogo.style.fontSize = "";

    root.style.removeProperty("--mobile-header-height");
    return;
  }

  root.style.setProperty(
    "--mobile-header-height",
    `${baseHeaderHeight}px`
  );

  mobileCafeHeader.classList.remove(
    "mobile-brand-wrapped"
  );

  mobileCafeName.style.fontSize = "";
  mobileCafeLogo.style.fontSize = "";

  let nameSize =
    parseFloat(getComputedStyle(mobileCafeName).fontSize) || 18;

  let logoSize =
    parseFloat(getComputedStyle(mobileCafeLogo).fontSize) || 22;

  const minNameSize = 12;
  const minLogoSize = 15;

  let fits = false;

  while (nameSize >= minNameSize) {
    mobileCafeName.style.fontSize = `${nameSize}px`;
    mobileCafeLogo.style.fontSize = `${logoSize}px`;

    if (
      mobileCafeTitle.scrollWidth <=
      mobileCafeTitle.clientWidth + 1
    ) {
      fits = true;
      break;
    }

    if (nameSize === minNameSize) {
      break;
    }

    nameSize = Math.max(
      minNameSize,
      nameSize - 0.5
    );

    logoSize = Math.max(
      minLogoSize,
      logoSize - 0.35
    );
  }

  mobileCafeName.style.fontSize =
    `${Math.max(nameSize, minNameSize)}px`;

  mobileCafeLogo.style.fontSize =
    `${Math.max(logoSize, minLogoSize)}px`;

  if (!fits) {
    mobileCafeHeader.classList.add(
      "mobile-brand-wrapped"
    );
  }

  // Match drawer top position to actual header height.
  root.style.setProperty(
    "--mobile-header-height",
    `${Math.ceil(
      mobileCafeHeader.getBoundingClientRect().height
    )}px`
  );
}


window.addEventListener("resize", () => {
  fitMobileCafeBrand();

  if (!isMobileLayout()) {
    closeMobilePanels();
  }
});


window.addEventListener(
  "orientationchange",
  fitMobileCafeBrand
);

window.addEventListener(
  "load",
  fitMobileCafeBrand
);

fitMobileCafeBrand();
