// Mock Redis client
jest.mock('redis', () => {
  const RedisMock = require('redis-mock');
  return {
    createClient: () => new RedisMock()
  };
});

// Mock request module
jest.mock('request', () => {
  return jest.fn((url, callback) => {
    // Default mock implementation
    callback(null, { statusCode: 200 }, JSON.stringify({
      sku: 'TEST-SKU',
      name: 'Test Product',
      price: 10.00,
      instock: 100
    }));
  });
});

// Set test environment variables
process.env.REDIS_HOST = 'localhost';
process.env.CATALOGUE_HOST = 'localhost';
process.env.CATALOGUE_PORT = '8080';
process.env.CART_SERVER_PORT = '8080'; 