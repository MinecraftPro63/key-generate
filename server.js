const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: [
    "http://127.0.0.1:5500",  // Allow requests from this origin
    "http://localhost:3000"    // Allow requests from this origin as well
  ],
  methods: ["GET", "POST"],
  credentials: true
}));
app.options("*", cors()); // Handle preflight requests
app.use(express.static(path.join(__dirname, "public")));

// Handle favicon request to avoid 404 error
app.get('/favicon.ico', (req, res) => res.status(204));

// Normalize IP address
function getNormalizedIP(req) {
  return req.ip === "::1" ? "127.0.0.1" : req.ip;
}

// Generate a random key of 18 characters
function generateRandomKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 18 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join("");
}

// File paths
const keysFilePath = path.join(__dirname, "keys.json");
const totalKeysPath = path.join(__dirname, "totalKeys.json");

// Initialize files if they don't exist
async function initializeFiles() {
  try {
    await fs.access(keysFilePath).catch(() => fs.writeFile(keysFilePath, JSON.stringify({})));
    await fs.access(totalKeysPath).catch(() => fs.writeFile(totalKeysPath, JSON.stringify({ total: 0 })));
  } catch (err) {
    console.error("Error initializing files:", err);
  }
}
initializeFiles();

// Get total keys
app.get("/getTotalKeys", async (req, res) => {
  try {
    const totalKeysData = JSON.parse(await fs.readFile(totalKeysPath, "utf8"));
    res.json({ total: totalKeysData.total });
  } catch (error) {
    console.error("Error reading total keys:", error);
    res.status(500).json({ error: "Failed to read total keys" });
  }
});

// Generate a new key
app.post("/generateKey", async (req, res) => {
  const ip = getNormalizedIP(req);
  try {
    const keysData = JSON.parse(await fs.readFile(keysFilePath, "utf8"));
    let userKeys = keysData[ip] || [];

    // Filter expired keys out
    const now = Date.now();
    userKeys = userKeys.filter(keyObj => keyObj.expiresAt > now);

    // If the user already has 3 active keys, do not allow generating more
    if (userKeys.length >= 3) {
      return res.json({ success: false, message: "You already have the maximum of 3 active keys." });
    }

    // Generate a new key if there are less than 3 active keys
    const newKey = generateRandomKey();
    const expirationTime = Date.now() + 12 * 60 * 60 * 1000; // 30 seconds
    userKeys.push({ key: newKey, expiresAt: expirationTime, status: "Active" });
    keysData[ip] = userKeys;

    await fs.writeFile(keysFilePath, JSON.stringify(keysData, null, 2));

    const totalKeysData = JSON.parse(await fs.readFile(totalKeysPath, "utf8"));
    totalKeysData.total += 1;
    await fs.writeFile(totalKeysPath, JSON.stringify(totalKeysData, null, 2));

    res.json({ success: true, key: newKey });
  } catch (error) {
    console.error("Error generating key:", error);
    res.status(500).json({ error: "Failed to generate key" });
  }
});

// Get user keys
app.get("/getUserKeys", async (req, res) => {
  const ip = getNormalizedIP(req);
  try {
    const keysData = JSON.parse(await fs.readFile(keysFilePath, "utf8"));
    const userKeys = keysData[ip] || [];

    const now = Date.now();
    const activeKeys = userKeys.map((keyObj) => {
      if (keyObj.expiresAt <= now) {
        keyObj.status = "Expired";
      } else {
        keyObj.status = "Active";
      }
      return keyObj;
    });

    keysData[ip] = userKeys; // Ensure the updated status is saved back to the file
    await fs.writeFile(keysFilePath, JSON.stringify(keysData, null, 2));

    res.json({ keys: activeKeys });
  } catch (error) {
    console.error("Error reading user keys:", error);
    res.status(500).json({ error: "Failed to read user keys" });
  }
});

// Get keys for the user (based on IP)
app.get("/getKeys", async (req, res) => {
  const ip = getNormalizedIP(req);
  try {
    const keysData = JSON.parse(await fs.readFile(keysFilePath, "utf8"));
    const userKeys = keysData[ip] || [];
    const now = Date.now();
    const activeKeys = userKeys.map((keyObj) => {
      if (keyObj.expiresAt <= now) {
        keyObj.status = "Expired";
      } else {
        keyObj.status = "Active";
      }
      return keyObj;
    });

    res.json({ keys: activeKeys });
  } catch (error) {
    console.error("Error reading keys:", error);
    res.status(500).json({ error: "Failed to retrieve keys" });
  }
});

// Renew a key
app.post('/renewKey', async (req, res) => {
  const { key } = req.body;
  try {
    const keysData = JSON.parse(await fs.readFile(keysFilePath, 'utf8'));
    let keyFound = false;

    for (const ip in keysData) {
      const userKeys = keysData[ip];
      for (const keyObj of userKeys) {
        if (keyObj.key === key) {
          keyObj.status = 'Active'; // Renew the key by changing status
          keyObj.expiresAt = Date.now() + 30 * 1000; // Renew expiration time
          keyFound = true;
          break;
        }
      }
      if (keyFound) break;
    }

    if (!keyFound) {
      return res.status(404).json({ success: false, message: 'Key not found.' });
    }

    await fs.writeFile(keysFilePath, JSON.stringify(keysData, null, 2));
    res.json({ success: true, message: 'Key renewed successfully!' });
  } catch (error) {
    console.error('Error renewing key:', error);
    res.status(500).json({ success: false, message: 'Failed to renew key' });
  }
});

// Delete a key
app.post('/deleteKey', async (req, res) => {
  const { key } = req.body;
  try {
    const keysData = JSON.parse(await fs.readFile(keysFilePath, 'utf8'));
    let keyFound = false;

    for (const ip in keysData) {
      const userKeys = keysData[ip];
      const keyIndex = userKeys.findIndex(k => k.key === key);
      if (keyIndex !== -1) {
        userKeys.splice(keyIndex, 1); // Remove the key from the array
        keyFound = true;
        break;
      }
    }

    if (!keyFound) {
      return res.status(404).json({ success: false, message: 'Key not found.' });
    }

    await fs.writeFile(keysFilePath, JSON.stringify(keysData, null, 2));
    res.json({ success: true, message: 'Key deleted successfully!' });
  } catch (error) {
    console.error('Error deleting key:', error);
    res.status(500).json({ success: false, message: 'Failed to delete key' });
  }
});

// Endpoint to handle the copy key request
app.get("/copy-key", async (req, res) => {
  const { key } = req.query;  // Extract the key from the query string
  try {
    const keysData = JSON.parse(await fs.readFile(keysFilePath, "utf8"));

    // Find if the key exists in the system
    let foundKey = null;
    for (const ip in keysData) {
      const userKeys = keysData[ip];
      for (const keyObj of userKeys) {
        if (keyObj.key === key) {
          foundKey = keyObj;  // Found the key
          break;
        }
      }
      if (foundKey) break;  // Stop looping once we find the key
    }

    if (foundKey) {
      res.json({ key: foundKey });
    } else {
      res.status(404).json({ error: "Key not found" });
    }
  } catch (error) {
    console.error("Error handling copy-key:", error);
    res.status(500).json({ error: "Failed to handle copy-key request" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
