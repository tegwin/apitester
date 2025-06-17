const corsAnywhere = require('cors-anywhere');
const host = '0.0.0.0';
const port = 3001;
corsAnywhere.createServer({
  originWhitelist: [],
  requireHeader: ['origin', 'x-requested-with'],
  removeHeaders: ['cookie', 'cookie2']
}).listen(port, host, () => {
  console.log(`CORS Anywhere proxy running on http://${host}:${port}`);
});