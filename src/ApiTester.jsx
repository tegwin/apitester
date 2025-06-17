// Core API Tester logic (proxy removed)
import { useState, useEffect } from "react";

export default function ApiTester() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState([{ key: "", value: "" }]);
  const [authType, setAuthType] = useState("none");
  const [authToken, setAuthToken] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [apiKeyName, setApiKeyName] = useState("");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [apiKeyLocation, setApiKeyLocation] = useState("header");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState(null);

  const handleSend = async () => {
    try {
      const headersObject = headers.reduce((acc, h) => {
        if (h.key) acc[h.key] = h.value;
        return acc;
      }, {});

      let finalUrl = url;

      if (authType === "bearer" && authToken) {
        headersObject["Authorization"] = `Bearer ${authToken}`;
      } else if (authType === "basic" && authUsername && authPassword) {
        const encoded = btoa(`${authUsername}:${authPassword}`);
        headersObject["Authorization"] = `Basic ${encoded}`;
      } else if (authType === "apikey" && apiKeyName && apiKeyValue) {
        if (apiKeyLocation === "header") {
          headersObject[apiKeyName] = apiKeyValue;
        } else if (apiKeyLocation === "query") {
          const urlObj = new URL(url);
          urlObj.searchParams.append(apiKeyName, apiKeyValue);
          finalUrl = urlObj.toString();
        }
      }

      const res = await fetch(finalUrl, {
        method,
        headers: headersObject,
        body: ["POST", "PUT", "PATCH"].includes(method) ? body : undefined,
      });

      const contentType = res.headers.get("content-type");
      let result;
      if (contentType && contentType.includes("application/json")) {
        result = await res.json();
      } else {
        result = await res.text();
      }

      setResponse({
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body: result,
      });
    } catch (e) {
      setResponse({ error: e.message });
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>🧪 API Tester Desktop</h1>
      <div>
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          {["GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com"
          style={{ width: "60%" }}
        />
        <button onClick={handleSend}>Send</button>
      </div>

      <div>
        <label>Auth Type</label>
        <select value={authType} onChange={(e) => setAuthType(e.target.value)}>
          <option value="none">None</option>
          <option value="bearer">Bearer</option>
          <option value="basic">Basic</option>
          <option value="apikey">API Key</option>
        </select>

        {authType === "bearer" && (
          <input value={authToken} onChange={(e) => setAuthToken(e.target.value)} placeholder="Token" />
        )}
        {authType === "basic" && (
          <>
            <input value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} placeholder="Username" />
            <input value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Password" />
          </>
        )}
        {authType === "apikey" && (
          <>
            <input value={apiKeyName} onChange={(e) => setApiKeyName(e.target.value)} placeholder="Key name" />
            <input value={apiKeyValue} onChange={(e) => setApiKeyValue(e.target.value)} placeholder="Key value" />
            <select value={apiKeyLocation} onChange={(e) => setApiKeyLocation(e.target.value)}>
              <option value="header">Header</option>
              <option value="query">Query</option>
            </select>
          </>
        )}
      </div>

      <div>
        <label>Headers</label>
        {headers.map((h, i) => (
          <div key={i}>
            <input
              placeholder="Header key"
              value={h.key}
              onChange={(e) => {
                const newHeaders = [...headers];
                newHeaders[i].key = e.target.value;
                setHeaders(newHeaders);
              }}
            />
            <input
              placeholder="Header value"
              value={h.value}
              onChange={(e) => {
                const newHeaders = [...headers];
                newHeaders[i].value = e.target.value;
                setHeaders(newHeaders);
              }}
            />
          </div>
        ))}
        <button onClick={() => setHeaders([...headers, { key: "", value: "" }])}>Add Header</button>
      </div>

      {["POST", "PUT", "PATCH"].includes(method) && (
        <textarea
          rows="5"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Raw body"
        />
      )}

      <div>
        <h3>Response</h3>
        {response?.error ? (
          <div style={{ color: "red" }}>{response.error}</div>
        ) : (
          <pre>{JSON.stringify(response?.body, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}