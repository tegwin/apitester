// Enhanced Postman-like web app with support for OAuth2 and API key authentication
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
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem("apiHistory");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("apiHistory", JSON.stringify(history));
  }, [history]);

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

      const newEntry = {
        id: Date.now(),
        method,
        url: finalUrl,
        headers,
        body,
        time: new Date().toLocaleString(),
      };
      setHistory([newEntry, ...history.slice(0, 19)]);

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
    <div className="p-6 space-y-6 max-w-5xl mx-auto bg-white shadow-xl rounded-xl">
      <h1 className="text-3xl font-bold text-center">🧪 API Tester</h1>

      <div className="flex space-x-2">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="border rounded p-2 w-28"
        >
          {["GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          className="border flex-1 p-2 rounded"
          placeholder="https://api.example.com/endpoint"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700" onClick={handleSend}>
          Send Request
        </button>
      </div>

      <div className="space-y-3">
        <label className="block font-semibold">Authentication:</label>
        <select
          value={authType}
          onChange={(e) => setAuthType(e.target.value)}
          className="border p-2 rounded w-60"
        >
          <option value="none">None</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth (username/password)</option>
          <option value="apikey">API Key</option>
        </select>

        {authType === "bearer" && (
          <input
            className="w-full border p-2 rounded"
            placeholder="Enter Bearer Token"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
          />
        )}

        {authType === "basic" && (
          <div className="space-y-2">
            <input
              className="w-full border p-2 rounded"
              placeholder="Username"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
            />
            <input
              className="w-full border p-2 rounded"
              placeholder="Password"
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
            />
          </div>
        )}

        {authType === "apikey" && (
          <div className="space-y-2">
            <input
              className="w-full border p-2 rounded"
              placeholder="API Key Name (e.g., X-API-KEY)"
              value={apiKeyName}
              onChange={(e) => setApiKeyName(e.target.value)}
            />
            <input
              className="w-full border p-2 rounded"
              placeholder="API Key Value"
              value={apiKeyValue}
              onChange={(e) => setApiKeyValue(e.target.value)}
            />
            <select
              className="border p-2 rounded w-60"
              value={apiKeyLocation}
              onChange={(e) => setApiKeyLocation(e.target.value)}
            >
              <option value="header">Add to Header</option>
              <option value="query">Add to Query Params</option>
            </select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="font-semibold">Headers:</label>
        {headers.map((h, i) => (
          <div key={i} className="flex space-x-2">
            <input
              className="border p-2 rounded w-1/2"
              placeholder="Header Key"
              value={h.key}
              onChange={(e) => {
                const newHeaders = [...headers];
                newHeaders[i].key = e.target.value;
                setHeaders(newHeaders);
              }}
            />
            <input
              className="border p-2 rounded w-1/2"
              placeholder="Header Value"
              value={h.value}
              onChange={(e) => {
                const newHeaders = [...headers];
                newHeaders[i].value = e.target.value;
                setHeaders(newHeaders);
              }}
            />
          </div>
        ))}
        <button
          className="text-blue-600 underline"
          onClick={() => setHeaders([...headers, { key: "", value: "" }])}
        >
          + Add Header
        </button>
      </div>

      {method !== "GET" && (
        <div>
          <label className="font-semibold">Request Body:</label>
          <textarea
            className="w-full border p-2 rounded min-h-[120px] font-mono text-sm"
            placeholder='{
  "example": "value"
}'
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
      )}

      {response && (
        <div className="border-t pt-6">
          <h2 className="text-xl font-bold">Response</h2>
          {response.error ? (
            <div className="text-red-600 font-mono">Error: {response.error}</div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm">Status: {response.status}</div>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(response.headers, null, 2)}
              </pre>
              <pre className="bg-gray-200 p-3 rounded text-sm overflow-auto">
                {typeof response.body === "object"
                  ? JSON.stringify(response.body, null, 2)
                  : response.body}
              </pre>
            </div>
          )}
        </div>
      )}

      <div className="border-t pt-6">
        <h2 className="text-xl font-bold mb-2">Request History</h2>
        <ul className="space-y-2 text-sm">
          {history.map((entry) => (
            <li key={entry.id} className="border p-3 rounded bg-gray-50">
              <div className="font-semibold">{entry.method} {entry.url}</div>
              <div className="text-gray-600 text-xs">{entry.time}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
