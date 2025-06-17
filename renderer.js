console.log('COMPLETE renderer.js with OAuth fix loading...');

let oauthToken = null;
let oauthWindow = null;
let callbackServer = null;
let authInProgress = false;
let currentCollection = 'default';
let collections = {};
let lastResponse = null;
let modalCallback = null;
let expandedCollections = new Set(['default']);

// EMERGENCY RESTORE FUNCTION - RUN THIS FIRST
function emergencyRestoreCollections() {
  collections = {
    default: {
      name: 'Default Collection',
      auth: { type: 'none' },
      requests: [],
      folders: []
    }
  };
  localStorage.setItem('collections', JSON.stringify(collections));
  console.log('Collections restored to default');
  renderCollections();
}

// Custom modal functions
function showModal(title, placeholder, callback) {
  const modal = document.getElementById('inputModal');
  const titleEl = document.getElementById('modalTitle');
  const inputEl = document.getElementById('modalInput');
  
  if (!modal || !titleEl || !inputEl) {
    const result = prompt(title);
    if (result && callback) {
      callback(result);
    }
    return;
  }
  
  titleEl.textContent = title;
  inputEl.placeholder = placeholder;
  inputEl.value = '';
  modal.style.display = 'block';
  modalCallback = callback;
  
  // Force focus after a small delay to ensure modal is visible
  setTimeout(() => {
    inputEl.focus();
    inputEl.select();
  }, 100);
}

function closeModal() {
  const modal = document.getElementById('inputModal');
  if (modal) {
    modal.style.display = 'none';
  }
  modalCallback = null;
}

function confirmModal() {
  const inputEl = document.getElementById('modalInput');
  const value = inputEl ? inputEl.value.trim() : '';
  const callback = modalCallback;
  
  if (callback && value) {
    callback(value);
  }
  
  closeModal();
}

// Tab switching - FIXED
function switchTab(tabName) {
  // Remove active from all tabs
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  // Add active to clicked tab
  document.querySelector(`.tab:nth-child(${
    tabName === 'params' ? '1' : 
    tabName === 'auth' ? '2' : 
    tabName === 'headers' ? '3' : '4'
  })`).classList.add('active');
  
  // Hide all tab panes
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
  // Show selected tab pane
  document.getElementById(tabName + '-tab').classList.add('active');
}

// Initialize collections
function initializeCollections() {
  try {
    const saved = localStorage.getItem('collections');
    if (saved) {
      collections = JSON.parse(saved);
      console.log('Loaded collections:', Object.keys(collections));
    } else {
      emergencyRestoreCollections();
    }
  } catch (error) {
    console.error('Error loading collections:', error);
    emergencyRestoreCollections();
  }
  renderCollections();
}

// Save collections
function saveCollections() {
  try {
    // Create backup first
    const current = localStorage.getItem('collections');
    if (current) {
      localStorage.setItem('collections_backup', current);
    }
    localStorage.setItem('collections', JSON.stringify(collections));
    console.log('Collections saved');
  } catch (error) {
    console.error('Error saving collections:', error);
  }
}

// Select a collection
function selectCollection(id) {
  if (!collections[id]) {
    console.error('Collection not found:', id);
    return;
  }
  currentCollection = id;
  document.querySelectorAll('.collection-item').forEach(el => el.classList.remove('active'));
  const element = document.querySelector(`[data-id="${id}"]`);
  if (element) {
    element.classList.add('active');
  }
  document.getElementById('requestTitle').textContent = collections[id].name;
  
  // Load collection auth settings if available
  const collectionAuth = collections[id].auth;
  if (collectionAuth && collectionAuth.type !== 'none') {
    // Set auth type to the collection's auth
    document.getElementById('authType').value = collectionAuth.type;
    toggleAuthSections();
    
    // Apply the auth configuration to UI
    applyAuthToUI(collectionAuth);
  } else {
    // Reset to no auth
    document.getElementById('authType').value = 'none';
    toggleAuthSections();
  }
  
  updateAuthInheritance();
}

// Toggle collection expansion
function toggleCollectionExpansion(id) {
  if (expandedCollections.has(id)) {
    expandedCollections.delete(id);
  } else {
    expandedCollections.add(id);
  }
  renderCollections();
}

// Render collections
function renderCollections() {
  const container = document.getElementById('collectionsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  Object.keys(collections).forEach(id => {
    const collection = collections[id];
    if (!collection) return;
    
    const collectionDiv = document.createElement('div');
    collectionDiv.className = `collection-item ${id === currentCollection ? 'active' : ''}`;
    collectionDiv.setAttribute('data-id', id);
    
    const requestCount = collection.requests ? collection.requests.length : 0;
    const isExpanded = expandedCollections.has(id);
    const arrow = isExpanded ? '▼' : '▶';
    
    collectionDiv.innerHTML = `
      <div class="collection-info">
        <span class="expand-arrow" style="margin-right: 5px; cursor: pointer; user-select: none;">${arrow}</span>
        📁 ${collection.name}
        <span style="color: #888; font-size: 11px; margin-left: 5px;">(${requestCount})</span>
      </div>
      <div class="collection-actions">
        <button class="icon-btn" onclick="saveRequestToCollection()" title="Add Request">+</button>
        <button class="icon-btn" onclick="exportSingleCollection('${id}')" title="Export">⬆</button>
        ${id !== 'default' ? `<button class="icon-btn" onclick="deleteSpecificCollection('${id}')" title="Delete">×</button>` : ''}
      </div>
    `;
    
    // Add click handler
    collectionDiv.addEventListener('click', function(e) {
      if (e.target.classList.contains('expand-arrow')) {
        e.stopPropagation();
        toggleCollectionExpansion(id);
      } else if (!e.target.closest('.collection-actions')) {
        selectCollection(id);
      }
    });
    
    // Add right-click context menu
    collectionDiv.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      showContextMenu(e, 'collection', id);
    });
    
    container.appendChild(collectionDiv);
    
    // Show requests if expanded
    if (isExpanded && collection.requests && collection.requests.length > 0) {
      collection.requests.forEach((request, index) => {
        const requestDiv = document.createElement('div');
        requestDiv.className = 'request-item';
        
        const methodColors = {
          GET: '#61affe',
          POST: '#49cc90', 
          PUT: '#fca130',
          DELETE: '#f93e3e',
          PATCH: '#50e3c2'
        };
        const methodColor = methodColors[request.method] || '#888';
        
        requestDiv.innerHTML = `
          <div class="request-info">
            <span style="color: ${methodColor}; font-weight: bold; margin-right: 8px;">${request.method}</span>
            <span>${request.name || 'Untitled Request'}</span>
          </div>
          <div class="request-actions">
            <button class="icon-btn" onclick="duplicateRequest('${id}', ${index})" title="Duplicate">⎘</button>
            <button class="icon-btn" onclick="deleteRequest('${id}', ${index})" title="Delete">×</button>
          </div>
        `;
        
        requestDiv.addEventListener('click', (e) => {
          if (!e.target.closest('.request-actions')) {
            e.stopPropagation();
            selectCollection(id);
            loadRequest(index);
          }
        });
        
        // Add right-click context menu
        requestDiv.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          showContextMenu(e, 'request', { collectionId: id, requestIndex: index });
        });
        
        container.appendChild(requestDiv);
      });
    }
  });
}

// Context menu functionality
let currentContextMenu = null;

function showContextMenu(event, type, data) {
  const contextMenu = document.getElementById('contextMenu');
  if (!contextMenu) return;
  
  // Hide any existing context menu
  hideContextMenu();
  
  // Store context data
  currentContextMenu = { type, data };
  
  // Update menu items based on type
  contextMenu.innerHTML = '';
  
  if (type === 'collection') {
    contextMenu.innerHTML = `
      <div class="context-menu-item" onclick="contextMenuAction('rename')">Rename</div>
      <div class="context-menu-item" onclick="contextMenuAction('duplicate')">Duplicate</div>
      <div class="context-menu-item" onclick="contextMenuAction('export')">Export</div>
      ${data !== 'default' ? `
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" onclick="contextMenuAction('delete')">Delete</div>
      ` : ''}
    `;
  } else if (type === 'request') {
    contextMenu.innerHTML = `
      <div class="context-menu-item" onclick="contextMenuAction('rename')">Rename</div>
      <div class="context-menu-item" onclick="contextMenuAction('duplicate')">Duplicate</div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" onclick="contextMenuAction('delete')">Delete</div>
    `;
  }
  
  // Position and show menu
  contextMenu.style.left = event.pageX + 'px';
  contextMenu.style.top = event.pageY + 'px';
  contextMenu.style.display = 'block';
  
  // Add click outside listener
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu);
  }, 0);
}

function hideContextMenu() {
  const contextMenu = document.getElementById('contextMenu');
  if (contextMenu) {
    contextMenu.style.display = 'none';
  }
  document.removeEventListener('click', hideContextMenu);
}

function contextMenuAction(action) {
  if (!currentContextMenu) return;
  
  const { type, data } = currentContextMenu;
  
  if (type === 'collection') {
    switch (action) {
      case 'rename':
        renameCollection(data);
        break;
      case 'duplicate':
        duplicateCollection(data);
        break;
      case 'export':
        exportSingleCollection(data);
        break;
      case 'delete':
        deleteSpecificCollection(data);
        break;
    }
  } else if (type === 'request') {
    switch (action) {
      case 'rename':
        renameRequest(data.collectionId, data.requestIndex);
        break;
      case 'duplicate':
        duplicateRequest(data.collectionId, data.requestIndex);
        break;
      case 'delete':
        deleteRequest(data.collectionId, data.requestIndex);
        break;
    }
  }
  
  hideContextMenu();
}

// New helper functions
function exportSingleCollection(collectionId) {
  const collection = collections[collectionId];
  if (!collection) return;
  
  const dataStr = JSON.stringify(collection, null, 2);
  const dataBlob = new Blob([dataStr], {type: 'application/json'});
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `${collection.name.replace(/\s+/g, '_')}.json`;
  link.click();
}

function deleteSpecificCollection(collectionId) {
  if (collectionId === 'default') {
    alert('Cannot delete the default collection');
    return;
  }
  
  if (confirm(`Delete collection "${collections[collectionId].name}"?`)) {
    delete collections[collectionId];
    saveCollections();
    if (currentCollection === collectionId) {
      selectCollection('default');
    }
    renderCollections();
  }
}

function renameCollection(collectionId) {
  const collection = collections[collectionId];
  if (!collection) return;
  
  showModal('Rename Collection', collection.name, function(newName) {
    if (newName && newName !== collection.name) {
      collection.name = newName;
      saveCollections();
      renderCollections();
      if (currentCollection === collectionId) {
        document.getElementById('requestTitle').textContent = newName;
      }
    }
  });
}

function duplicateCollection(collectionId) {
  const collection = collections[collectionId];
  if (!collection) return;
  
  const newId = 'col_' + Date.now();
  collections[newId] = JSON.parse(JSON.stringify(collection));
  collections[newId].name = collection.name + ' Copy';
  
  saveCollections();
  renderCollections();
  selectCollection(newId);
}

function deleteRequest(collectionId, requestIndex) {
  const collection = collections[collectionId];
  if (!collection || !collection.requests || !collection.requests[requestIndex]) return;
  
  if (confirm(`Delete request "${collection.requests[requestIndex].name}"?`)) {
    collection.requests.splice(requestIndex, 1);
    saveCollections();
    renderCollections();
  }
}

function duplicateRequest(collectionId, requestIndex) {
  const collection = collections[collectionId];
  if (!collection || !collection.requests || !collection.requests[requestIndex]) return;
  
  const request = collection.requests[requestIndex];
  const newRequest = JSON.parse(JSON.stringify(request));
  newRequest.name = request.name + ' Copy';
  newRequest.createdAt = new Date().toISOString();
  
  collection.requests.push(newRequest);
  saveCollections();
  renderCollections();
}

function renameRequest(collectionId, requestIndex) {
  const collection = collections[collectionId];
  if (!collection || !collection.requests || !collection.requests[requestIndex]) return;
  
  const request = collection.requests[requestIndex];
  
  showModal('Rename Request', request.name, function(newName) {
    if (newName && newName !== request.name) {
      request.name = newName;
      saveCollections();
      renderCollections();
    }
  });
}

// Load request
function loadRequest(index) {
  const collection = collections[currentCollection];
  if (!collection || !collection.requests || !collection.requests[index]) {
    console.error('Request not found');
    return;
  }
  
  const request = collection.requests[index];
  
  document.getElementById('method').value = request.method || 'GET';
  document.getElementById('url').value = request.url || '';
  document.getElementById('queryParams').value = request.queryParams || '';
  document.getElementById('headers').value = request.headers || '';
  document.getElementById('body').value = request.body || '';
  
  if (request.authType) {
    document.getElementById('authType').value = request.authType;
    toggleAuthSections();
    
    // Load the saved auth configuration
    if (request.authConfig) {
      applyAuthToUI(request.authConfig);
    }
  }
  
  document.getElementById('requestTitle').textContent = request.name || 'Untitled Request';
  showOAuthStatus(`Loaded: ${request.name}`, 'success');
}

// Apply auth configuration to UI fields
function applyAuthToUI(authConfig) {
  if (!authConfig) return;
  
  switch(authConfig.type) {
    case 'bearer':
      document.getElementById('authToken').value = authConfig.token || '';
      break;
    case 'basic':
      document.getElementById('authUsername').value = authConfig.username || '';
      document.getElementById('authPassword').value = authConfig.password || '';
      break;
    case 'apikey':
      document.getElementById('apiKeyName').value = authConfig.name || '';
      document.getElementById('apiKeyValue').value = authConfig.value || '';
      document.getElementById('apiKeyLocation').value = authConfig.location || 'header';
      break;
    case 'oauth2':
      // Load OAuth config
      if (authConfig.grantType) {
        document.getElementById('oauthGrantType').value = authConfig.grantType;
        toggleOAuthGrantType();
      }
      if (authConfig.clientId) {
        document.getElementById('oauthClientId').value = authConfig.clientId;
      }
      if (authConfig.clientSecret) {
        document.getElementById('oauthClientSecret').value = authConfig.clientSecret;
      }
      if (authConfig.tokenUrl) {
        document.getElementById('oauthTokenUrl').value = authConfig.tokenUrl;
      }
      if (authConfig.scope) {
        document.getElementById('oauthScope').value = authConfig.scope;
      }
      if (authConfig.token) {
        oauthToken = authConfig.token;
        const tokenDiv = document.getElementById('tokenDisplay');
        if (tokenDiv) {
          tokenDiv.innerHTML = `
            <div style="margin-top: 10px;">
              <strong>Access Token (Saved):</strong>
              <div class="token-display">${authConfig.token.substring(0, 50)}...</div>
            </div>
          `;
        }
        document.getElementById('oauthGetTokenBtn').disabled = true;
        document.getElementById('clearOauthBtn').disabled = false;
      }
      break;
  }
}

// Create collection
function createCollection() {
  showModal('Create New Collection', 'Enter collection name...', function(name) {
    if (!name) return;
    
    const id = 'col_' + Date.now();
    collections[id] = {
      name: name,
      auth: { type: 'none' },
      requests: [],
      folders: []
    };
    
    saveCollections();
    renderCollections();
    selectCollection(id);
  });
}

// Delete collection
function deleteCollection() {
  if (currentCollection === 'default') {
    alert('Cannot delete the default collection');
    return;
  }
  
  if (confirm(`Delete collection "${collections[currentCollection].name}"?`)) {
    delete collections[currentCollection];
    saveCollections();
    selectCollection('default');
    renderCollections();
  }
}

// Export collection
function exportCollection() {
  const collection = collections[currentCollection];
  const dataStr = JSON.stringify(collection, null, 2);
  const dataBlob = new Blob([dataStr], {type: 'application/json'});
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `${collection.name.replace(/\s+/g, '_')}.json`;
  link.click();
}

// Import collection
function importCollection() {
  document.getElementById('importFile').click();
}

// Handle import
function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      const id = 'col_' + Date.now();
      
      // Handle Postman format
      if (data.info && data.info.name && data.item) {
        collections[id] = convertPostmanCollection(data);
      } else {
        // Native format
        collections[id] = {
          name: data.name || 'Imported Collection',
          auth: data.auth || { type: 'none' },
          requests: data.requests || [],
          folders: data.folders || []
        };
      }
      
      saveCollections();
      renderCollections();
      selectCollection(id);
      showOAuthStatus('Collection imported!', 'success');
      
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import collection');
    }
  };
  reader.readAsText(file);
}

// Convert Postman collection
function convertPostmanCollection(postmanData) {
  const collection = {
    name: postmanData.info.name || 'Imported Collection',
    auth: { type: 'none' },
    requests: [],
    folders: []
  };
  
  // Convert items
  if (postmanData.item) {
    postmanData.item.forEach(item => {
      if (item.request) {
        collection.requests.push(convertPostmanRequest(item));
      } else if (item.item) {
        // Folder with sub-items
        item.item.forEach(subItem => {
          if (subItem.request) {
            const request = convertPostmanRequest(subItem);
            request.folder = item.name;
            collection.requests.push(request);
          }
        });
      }
    });
  }
  
  return collection;
}

// Convert Postman request
function convertPostmanRequest(postmanItem) {
  const request = postmanItem.request;
  const converted = {
    name: postmanItem.name || 'Untitled Request',
    method: (request.method || 'GET').toUpperCase(),
    url: '',
    queryParams: '',
    headers: '',
    body: '',
    authType: 'none',
    createdAt: new Date().toISOString()
  };
  
  // Convert URL
  if (typeof request.url === 'string') {
    converted.url = request.url;
  } else if (request.url && request.url.raw) {
    converted.url = request.url.raw;
  }
  
  // Convert headers
  if (request.header) {
    const headers = request.header
      .filter(h => !h.disabled)
      .map(h => `${h.key}: ${h.value || ''}`)
      .join('\n');
    converted.headers = headers;
  }
  
  // Convert body
  if (request.body && request.body.mode === 'raw') {
    converted.body = request.body.raw || '';
  }
  
  return converted;
}

// Toggle auth sections
function toggleAuthSections() {
  const authType = document.getElementById("authType").value;
  const sections = document.querySelectorAll('.auth-section');
  
  sections.forEach(section => section.classList.remove('active'));
  
  switch(authType) {
    case 'bearer':
      document.getElementById('bearerSection').classList.add('active');
      break;
    case 'basic':
      document.getElementById('basicSection').classList.add('active');
      break;
    case 'apikey':
      document.getElementById('apikeySection').classList.add('active');
      break;
    case 'oauth2':
      document.getElementById('oauth2Section').classList.add('active');
      break;
  }
}

// Update auth inheritance
function updateAuthInheritance() {
  const authType = document.getElementById("authType").value;
  const inheritance = document.getElementById("authInheritance");
  
  if (authType === 'inherit' && inheritance) {
    inheritance.style.display = 'inline-block';
    const collectionAuth = collections[currentCollection]?.auth;
    if (collectionAuth && collectionAuth.type !== 'none') {
      inheritance.textContent = `Inherited: ${collectionAuth.type}`;
    } else {
      inheritance.textContent = 'No auth in collection';
    }
  } else if (inheritance) {
    inheritance.style.display = 'none';
  }
}

// Save auth to collection
function saveAuthToCollection() {
  const authType = document.getElementById("authType").value;
  const authConfig = getCurrentAuthConfig();
  
  // Save to current collection
  collections[currentCollection].auth = authConfig;
  saveCollections();
  
  // Also update any existing requests in this collection to inherit if they were set to inherit
  if (collections[currentCollection].requests) {
    collections[currentCollection].requests.forEach(request => {
      if (request.authType === 'inherit') {
        // Update the request to reflect the new collection auth
        request.authConfig = authConfig;
      }
    });
  }
  
  showOAuthStatus('Authentication saved to collection!', 'success');
  updateAuthInheritance();
}

// Get current auth config
function getCurrentAuthConfig() {
  const authType = document.getElementById("authType").value;
  const config = { type: authType };
  
  switch(authType) {
    case 'bearer':
      config.token = document.getElementById('authToken').value;
      break;
    case 'basic':
      config.username = document.getElementById('authUsername').value;
      config.password = document.getElementById('authPassword').value;
      break;
    case 'apikey':
      config.name = document.getElementById('apiKeyName').value;
      config.value = document.getElementById('apiKeyValue').value;
      config.location = document.getElementById('apiKeyLocation').value;
      break;
    case 'oauth2':
      const grantType = document.getElementById('oauthGrantType').value;
      config.grantType = grantType;
      
      if (grantType === 'client_credentials') {
        config.clientId = document.getElementById('oauthClientId').value;
        config.clientSecret = document.getElementById('oauthClientSecret').value;
        config.tokenUrl = document.getElementById('oauthTokenUrl').value;
        config.scope = document.getElementById('oauthScope').value;
      } else {
        config.clientId = document.getElementById('oauthClientIdAuth').value;
        config.clientSecret = document.getElementById('oauthClientSecretAuth').value;
        config.authUrl = document.getElementById('oauthAuthUrl').value;
        config.tokenUrl = document.getElementById('oauthTokenUrlAuth').value;
        config.redirectUri = document.getElementById('oauthRedirectUri').value;
        config.scope = document.getElementById('oauthScopeAuth').value;
      }
      
      config.token = oauthToken;
      break;
  }
  
  return config;
}

// Apply auth config
function applyAuthConfig(config) {
  if (!config || config.type === 'none') return {};
  
  const headers = {};
  
  switch(config.type) {
    case 'bearer':
      if (config.token) {
        headers["Authorization"] = `Bearer ${config.token}`;
      }
      break;
    case 'basic':
      if (config.username && config.password) {
        headers["Authorization"] = "Basic " + btoa(`${config.username}:${config.password}`);
      }
      break;
    case 'apikey':
      if (config.name && config.value) {
        if (config.location === 'header') {
          headers[config.name] = config.value;
        } else {
          return { headers, modifyUrl: (url) => {
            const urlObj = new URL(url);
            urlObj.searchParams.append(config.name, config.value);
            return urlObj.toString();
          }};
        }
      }
      break;
    case 'oauth2':
      if (config.token || oauthToken) {
        headers["Authorization"] = `Bearer ${config.token || oauthToken}`;
      }
      break;
  }
  
  return { headers, modifyUrl: null };
}

// OAuth functions
function toggleOAuthGrantType() {
  const grantType = document.getElementById("oauthGrantType").value;
  document.getElementById("clientCredentialsSection").style.display = 
    grantType === "client_credentials" ? "block" : "none";
  document.getElementById("authCodeSection").style.display = 
    grantType === "authorization_code" ? "block" : "none";
}

function showOAuthStatus(message, type) {
  const statusDiv = document.getElementById('oauthStatus');
  if (statusDiv) {
    statusDiv.className = `oauth-status ${type}`;
    statusDiv.textContent = message;
  }
}

// FIXED OAuth token function
function getClientCredentialsToken() {
  const clientId = document.getElementById('oauthClientId').value.trim();
  const clientSecret = document.getElementById('oauthClientSecret').value.trim();
  const tokenUrl = document.getElementById('oauthTokenUrl').value.trim();
  const scope = document.getElementById('oauthScope').value.trim();
  
  if (!clientId || !clientSecret || !tokenUrl) {
    showOAuthStatus('Client ID, Client Secret, and Access Token URL are required', 'error');
    return;
  }

  const tokenData = {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret
  };

  if (scope) {
    tokenData.scope = scope;
  }

  showOAuthStatus('Requesting access token...', 'info');
  
  // Make the actual token request
  fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(tokenData)
  })
  .then(response => {
    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(`HTTP ${response.status}: ${text}`);
      });
    }
    return response.json();
  })
  .then(tokenResponse => {
    console.log('Token response:', tokenResponse);
    
    if (tokenResponse.access_token) {
      oauthToken = tokenResponse.access_token;
      showOAuthStatus('Access token obtained successfully!', 'success');
      
      // Display the token
      const tokenDiv = document.getElementById('tokenDisplay');
      if (tokenDiv) {
        let html = '<div style="margin-top: 10px;">';
        html += '<strong>Access Token:</strong>';
        html += `<div class="token-display">${tokenResponse.access_token.substring(0, 50)}...</div>`;
        
        if (tokenResponse.expires_in) {
          html += `<div style="margin-top: 5px;"><strong>Expires in:</strong> ${tokenResponse.expires_in} seconds</div>`;
        }
        
        if (tokenResponse.token_type) {
          html += `<div><strong>Token Type:</strong> ${tokenResponse.token_type}</div>`;
        }
        
        html += '</div>';
        tokenDiv.innerHTML = html;
      }
      
      // Enable/disable buttons
      document.getElementById('oauthGetTokenBtn').disabled = true;
      document.getElementById('clearOauthBtn').disabled = false;
    } else {
      throw new Error('No access token in response');
    }
  })
  .catch(error => {
    console.error('OAuth error:', error);
    showOAuthStatus('Failed to get access token: ' + error.message, 'error');
  });
}

function clearOAuthToken() {
  oauthToken = null;
  document.getElementById('oauthStatus').innerHTML = '';
  document.getElementById('tokenDisplay').innerHTML = '';
  
  // Enable/disable buttons
  document.getElementById('oauthGetTokenBtn').disabled = false;
  document.getElementById('clearOauthBtn').disabled = true;
  
  showOAuthStatus('Token cleared', 'info');
}

// OAuth config functions - SIMPLIFIED
function saveOAuthConfig() {
  // Just save to collection instead
  saveAuthToCollection();
}

function loadOAuthConfig() {
  // Load from collection auth
  const collectionAuth = collections[currentCollection].auth;
  if (collectionAuth && collectionAuth.type === 'oauth2') {
    applyAuthToUI(collectionAuth);
    showOAuthStatus('OAuth configuration loaded from collection!', 'success');
  } else {
    showOAuthStatus('No OAuth configuration in this collection', 'error');
  }
}

function clearOAuthConfig() {
  // Clear OAuth fields
  document.getElementById('oauthClientId').value = '';
  document.getElementById('oauthClientSecret').value = '';
  document.getElementById('oauthTokenUrl').value = '';
  document.getElementById('oauthScope').value = '';
  document.getElementById('oauthClientIdAuth').value = '';
  document.getElementById('oauthClientSecretAuth').value = '';
  document.getElementById('oauthAuthUrl').value = '';
  document.getElementById('oauthTokenUrlAuth').value = '';
  document.getElementById('oauthRedirectUri').value = '';
  document.getElementById('oauthScopeAuth').value = '';
  
  // Clear from collection if OAuth is selected
  if (document.getElementById('authType').value === 'oauth2') {
    collections[currentCollection].auth = { type: 'none' };
    saveCollections();
  }
  
  showOAuthStatus('OAuth configuration cleared', 'info');
}

// Save request
function saveRequestToCollection() {
  showModal('Save Request', 'Enter request name...', function(name) {
    if (!name) return;
    
    const request = {
      name: name,
      method: document.getElementById('method').value,
      url: document.getElementById('url').value,
      queryParams: document.getElementById('queryParams').value,
      headers: document.getElementById('headers').value,
      body: document.getElementById('body').value,
      authType: document.getElementById('authType').value,
      createdAt: new Date().toISOString()
    };
    
    // Save the full auth configuration with the request
    const authType = document.getElementById('authType').value;
    if (authType === 'oauth2') {
      request.authConfig = {
        type: 'oauth2',
        grantType: document.getElementById('oauthGrantType').value,
        clientId: document.getElementById('oauthClientId').value,
        clientSecret: document.getElementById('oauthClientSecret').value,
        tokenUrl: document.getElementById('oauthTokenUrl').value,
        scope: document.getElementById('oauthScope').value,
        token: oauthToken
      };
    } else if (authType === 'bearer') {
      request.authConfig = {
        type: 'bearer',
        token: document.getElementById('authToken').value
      };
    } else if (authType === 'basic') {
      request.authConfig = {
        type: 'basic',
        username: document.getElementById('authUsername').value,
        password: document.getElementById('authPassword').value
      };
    } else if (authType === 'apikey') {
      request.authConfig = {
        type: 'apikey',
        name: document.getElementById('apiKeyName').value,
        value: document.getElementById('apiKeyValue').value,
        location: document.getElementById('apiKeyLocation').value
      };
    }
    
    if (!collections[currentCollection].requests) {
      collections[currentCollection].requests = [];
    }
    
    collections[currentCollection].requests.push(request);
    saveCollections();
    renderCollections();
    showOAuthStatus(`Request "${name}" saved!`, 'success');
  });
}

// Parse headers
function parseHeaders() {
  const headersText = document.getElementById("headers").value;
  const headers = {};
  
  if (!headersText.trim()) return headers;
  
  headersText.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) return;
    
    const name = trimmed.substring(0, colonIndex).trim();
    const value = trimmed.substring(colonIndex + 1).trim();
    
    if (name && value) {
      headers[name] = value;
    }
  });
  
  return headers;
}

// Parse query params
function parseQueryParams() {
  const paramsText = document.getElementById("queryParams").value;
  const params = {};
  
  if (!paramsText.trim()) return params;
  
  paramsText.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) return;
    
    const name = trimmed.substring(0, equalIndex).trim();
    const value = trimmed.substring(equalIndex + 1).trim();
    
    if (name && value) {
      params[name] = value;
    }
  });
  
  return params;
}

// Add common headers
function addCommonHeaders() {
  const headers = document.getElementById("headers");
  const common = ["Content-Type: application/json", "Accept: application/json"];
  let current = headers.value;
  if (current && !current.endsWith('\n')) current += '\n';
  headers.value = current + common.join('\n');
}

// Add common params
function addCommonParams() {
  const params = document.getElementById("queryParams");
  const common = ["limit=10", "offset=0"];
  let current = params.value;
  if (current && !current.endsWith('\n')) current += '\n';
  params.value = current + common.join('\n');
}

// Copy response
function copyResponse() {
  if (!lastResponse) return;
  
  const text = typeof lastResponse === 'string' ? lastResponse : JSON.stringify(lastResponse, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy Response', 1000);
  });
}

// Display response status
function displayResponseStatus(status, statusText, responseTime) {
  const badge = document.getElementById('statusBadge');
  const timeEl = document.getElementById('responseTime');
  const copyBtn = document.getElementById('copyBtn');
  
  badge.textContent = `${status} ${statusText}`;
  badge.style.display = 'block';
  copyBtn.style.display = 'block';
  
  badge.className = 'status-badge';
  if (status >= 200 && status < 300) {
    badge.classList.add('status-2xx');
  } else if (status >= 300 && status < 400) {
    badge.classList.add('status-3xx');
  } else if (status >= 400 && status < 500) {
    badge.classList.add('status-4xx');
  } else if (status >= 500) {
    badge.classList.add('status-5xx');
  }
  
  if (responseTime) {
    timeEl.textContent = `${responseTime}ms`;
    timeEl.style.display = 'block';
  }
}

// Send request
async function sendRequest() {
  const startTime = Date.now();
  const method = document.getElementById("method").value;
  let url = document.getElementById("url").value.trim();
  const headers = parseHeaders();
  const body = document.getElementById("body").value;
  const authType = document.getElementById("authType").value;

  if (!url) {
    document.getElementById("response").textContent = "Please enter a URL";
    return;
  }

  // Handle query parameters
  const queryParams = parseQueryParams();
  if (Object.keys(queryParams).length > 0) {
    const urlObj = new URL(url);
    Object.keys(queryParams).forEach(key => {
      urlObj.searchParams.append(key, queryParams[key]);
    });
    url = urlObj.toString();
  }

  try {
    // Handle authentication
    let authConfig = null;
    
    if (authType === 'inherit') {
      authConfig = collections[currentCollection].auth;
    } else if (authType !== 'none') {
      authConfig = getCurrentAuthConfig();
    }
    
    if (authConfig) {
      const authResult = applyAuthConfig(authConfig);
      Object.assign(headers, authResult.headers);
      if (authResult.modifyUrl) {
        url = authResult.modifyUrl(url);
      }
    }

    // For OAuth2, use the current token
    if (authType === 'oauth2' && oauthToken) {
      headers["Authorization"] = `Bearer ${oauthToken}`;
    }

    console.log('Sending request:', { method, url, headers });

    const response = await fetch(url, {
      method,
      headers,
      body: ["POST", "PUT", "PATCH"].includes(method) ? body : undefined,
    });

    const responseTime = Date.now() - startTime;
    const contentType = response.headers.get("content-type");
    
    let result;
    if (contentType && contentType.includes("application/json")) {
      result = await response.json();
    } else {
      result = await response.text();
    }

    lastResponse = result;

    const responseOutput = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: result
    };

    document.getElementById("response").textContent = JSON.stringify(responseOutput, null, 2);
    displayResponseStatus(response.status, response.statusText, responseTime);

  } catch (err) {
    console.error('Request error:', err);
    lastResponse = err.message;
    document.getElementById("response").textContent = "Error: " + err.message;
    displayResponseStatus(0, "Network Error", null);
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded - initializing app');
  
  // Fix layout issues - prevent sidebar from shrinking
  const style = document.createElement('style');
  style.textContent = `
    .sidebar {
      flex-shrink: 0 !important;
      min-width: 300px !important;
      width: 300px !important;
    }
    .main-content {
      flex-shrink: 1 !important;
      min-width: 0 !important;
    }
    .app-container {
      display: flex !important;
      overflow: hidden !important;
    }
  `;
  document.head.appendChild(style);
  
  // Put all functions in global scope
  window.emergencyRestoreCollections = emergencyRestoreCollections;
  window.showModal = showModal;
  window.closeModal = closeModal;
  window.confirmModal = confirmModal;
  window.switchTab = switchTab;
  window.selectCollection = selectCollection;
  window.toggleCollectionExpansion = toggleCollectionExpansion;
  window.createCollection = createCollection;
  window.deleteCollection = deleteCollection;
  window.exportCollection = exportCollection;
  window.importCollection = importCollection;
  window.handleImport = handleImport;
  window.toggleAuthSections = toggleAuthSections;
  window.saveAuthToCollection = saveAuthToCollection;
  window.toggleOAuthGrantType = toggleOAuthGrantType;
  window.getClientCredentialsToken = getClientCredentialsToken;
  window.clearOAuthToken = clearOAuthToken;
  window.saveOAuthConfig = saveOAuthConfig;
  window.loadOAuthConfig = loadOAuthConfig;
  window.clearOAuthConfig = clearOAuthConfig;
  window.saveRequestToCollection = saveRequestToCollection;
  window.sendRequest = sendRequest;
  window.addCommonHeaders = addCommonHeaders;
  window.addCommonParams = addCommonParams;
  window.copyResponse = copyResponse;
  window.loadRequest = loadRequest;
  window.applyAuthToUI = applyAuthToUI;
  window.showContextMenu = showContextMenu;
  window.hideContextMenu = hideContextMenu;
  window.contextMenuAction = contextMenuAction;
  window.exportSingleCollection = exportSingleCollection;
  window.deleteSpecificCollection = deleteSpecificCollection;
  window.renameCollection = renameCollection;
  window.duplicateCollection = duplicateCollection;
  window.deleteRequest = deleteRequest;
  window.duplicateRequest = duplicateRequest;
  window.renameRequest = renameRequest;
  
  // Initialize the app
  initializeCollections();
  toggleAuthSections();
  toggleOAuthGrantType();
  
  console.log('App initialized successfully');
});

console.log('renderer.js loaded');