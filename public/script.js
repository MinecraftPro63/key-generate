const generateBtn = document.getElementById("generate-btn");
const keyBox = document.getElementById("key-box");
const copyBtn = document.getElementById("copy-btn");
const keyDisplay = document.getElementById("key-display");
const keyExpiry = document.getElementById("key-expiry");
const totalKeysDisplay = document.getElementById("total-keys");
const dashboardContainer = document.getElementById("dashboard-container");

let userIP = null; // Placeholder for IP (will be fetched from the server)

// Fetch user IP and update the page
fetch("/getIP")
  .then((response) => response.json())
  .then((data) => {
    userIP = data.ip;
    updateKeys();
  });

// Generate a key
generateBtn.addEventListener("click", () => {
  fetch("/generateKey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ip: userIP }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        keyBox.textContent = data.key;
        keyDisplay.classList.remove("hidden");
        keyExpiry.classList.remove("hidden");
        keyExpiry.textContent = `Expires in 30 seconds.`;
        updateKeys();
        updateTotalKeys();
      } else {
        alert(data.message);
      }
    });
});

// Copy key to clipboard
copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(keyBox.textContent);
  alert("Key copied to clipboard!");
});

// Update keys on the dashboard
function updateKeys() {
  if (!dashboardContainer) return;
  fetch("/getKeys?ip=" + userIP)
    .then((response) => response.json())
    .then((data) => {
      dashboardContainer.innerHTML = "";
      data.keys.forEach((key) => {
        const keyElement = document.createElement("div");
        keyElement.innerHTML = `
          <div>${key.key}</div>
          <div>${key.status}</div>
          <button onclick="renewKey('${key.key}')">Renew</button>
          <button onclick="deleteKey('${key.key}')">Delete</button>
        `;
        dashboardContainer.appendChild(keyElement);
      });
    });
}

// Update total keys
function updateTotalKeys() {
  fetch("/getTotalKeys")
    .then((response) => response.json())
    .then((data) => {
      totalKeysDisplay.textContent = `Total Keys: ${data.total}`;
    });
}

// Renew a key
function renewKey(key) {
  fetch("/renewKey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  }).then(() => updateKeys());
}

// Delete a key
function deleteKey(key) {
  fetch("/deleteKey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  }).then(() => updateKeys());
}
