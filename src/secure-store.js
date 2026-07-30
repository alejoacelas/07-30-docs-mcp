export class UpstashStore {
  constructor(env = process.env, fetchImpl = fetch) {
    this.url = env.UPSTASH_REST_URL;
    this.token = env.UPSTASH_REST_TOKEN;
    this.fetchImpl = fetchImpl;
    if (!this.url || !this.token) {
      throw new Error("UPSTASH_REST_URL and UPSTASH_REST_TOKEN are required");
    }
  }

  async command(command) {
    const response = await this.fetchImpl(this.url, {
      method: "POST",
      redirect: "error",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(command)
    });
    const value = await response.json();
    if (!response.ok || value.error) {
      throw new Error(`Redis command failed: ${value.error || response.status}`);
    }
    return value.result;
  }

  async set(key, value, ttlSeconds, { nx = false } = {}) {
    const command = ["SET", key, value, "EX", ttlSeconds];
    if (nx) command.push("NX");
    return (await this.command(command)) === "OK";
  }

  get(key) {
    return this.command(["GET", key]);
  }

  getdel(key) {
    return this.command(["GETDEL", key]);
  }

  del(key) {
    return this.command(["DEL", key]);
  }
}

export class MemoryStore {
  constructor(now = () => Date.now()) {
    this.values = new Map();
    this.now = now;
  }

  purge(key) {
    const item = this.values.get(key);
    if (item && item.expiresAt <= this.now()) this.values.delete(key);
  }

  async set(key, value, ttlSeconds, { nx = false } = {}) {
    this.purge(key);
    if (nx && this.values.has(key)) return false;
    this.values.set(key, {
      value,
      expiresAt: this.now() + ttlSeconds * 1000
    });
    return true;
  }

  async get(key) {
    this.purge(key);
    return this.values.get(key)?.value ?? null;
  }

  async getdel(key) {
    const value = await this.get(key);
    this.values.delete(key);
    return value;
  }

  async del(key) {
    const existed = this.values.delete(key);
    return existed ? 1 : 0;
  }
}
