// Stable per browser, so a reservation can be traced to a remote without
// trusting a nickname anyone could type.

const DEVICE_ID_KEY = "karaoke-device-id";

function generate(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getDeviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;

    const created = generate();
    localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch (error) {
    console.warn("Failed to persist device id:", error);
    return generate();
  }
}
