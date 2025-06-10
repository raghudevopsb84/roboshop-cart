const request = require('supertest');
const redis = require('redis');
const requestModule = require('request');
const app = require('../server');

describe('Cart Service', () => {
  let redisClient;
  
  beforeEach(() => {
    redisClient = redis.createClient();
    // Clear Redis before each test
    return new Promise((resolve) => {
      redisClient.flushall(() => resolve());
    });
  });

  afterEach(() => {
    redisClient.quit();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        app: 'OK',
        redis: true
      });
    });
  });

  describe('Cart Operations', () => {
    const testCartId = 'test-cart-1';
    const testSku = 'TEST-SKU';

    describe('GET /cart/:id', () => {
      it('should return 404 for non-existent cart', async () => {
        const response = await request(app).get(`/cart/${testCartId}`);
        expect(response.status).toBe(404);
      });

      it('should return cart data for existing cart', async () => {
        const testCart = {
          total: 0,
          tax: 0,
          items: []
        };
        await new Promise((resolve) => {
          redisClient.setex(testCartId, 3600, JSON.stringify(testCart), () => resolve());
        });

        const response = await request(app).get(`/cart/${testCartId}`);
        expect(response.status).toBe(200);
        expect(response.body).toEqual(testCart);
      });
    });

    describe('DELETE /cart/:id', () => {
      it('should return 404 for non-existent cart', async () => {
        const response = await request(app).delete(`/cart/${testCartId}`);
        expect(response.status).toBe(404);
      });

      it('should delete existing cart', async () => {
        await new Promise((resolve) => {
          redisClient.setex(testCartId, 3600, JSON.stringify({ items: [] }), () => resolve());
        });

        const response = await request(app).delete(`/cart/${testCartId}`);
        expect(response.status).toBe(200);
        expect(response.text).toBe('OK');

        // Verify cart is deleted
        const getResponse = await request(app).get(`/cart/${testCartId}`);
        expect(getResponse.status).toBe(404);
      });
    });

    describe('GET /add/:id/:sku/:qty', () => {
      it('should return 400 for invalid quantity', async () => {
        const response = await request(app).get(`/add/${testCartId}/${testSku}/0`);
        expect(response.status).toBe(400);
        expect(response.text).toBe('quantity has to be greater than zero');
      });

      it('should return 404 for non-existent product', async () => {
        // Mock product not found
        requestModule.mockImplementationOnce((url, callback) => {
          callback(null, { statusCode: 404 }, null);
        });

        const response = await request(app).get(`/add/${testCartId}/${testSku}/1`);
        expect(response.status).toBe(404);
        expect(response.text).toBe('product not found');
      });

      it('should add item to cart successfully', async () => {
        const response = await request(app).get(`/add/${testCartId}/${testSku}/2`);
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          items: [{
            sku: testSku,
            qty: 2,
            price: 10.00,
            subtotal: 20.00
          }],
          total: 20.00
        });
        expect(response.body.tax).toBeGreaterThan(0);
      });
    });

    describe('GET /update/:id/:sku/:qty', () => {
      beforeEach(async () => {
        // Add an item to cart first
        await request(app).get(`/add/${testCartId}/${testSku}/2`);
      });

      it('should return 400 for negative quantity', async () => {
        const response = await request(app).get(`/update/${testCartId}/${testSku}/-1`);
        expect(response.status).toBe(400);
        expect(response.text).toBe('negative quantity not allowed');
      });

      it('should return 404 for non-existent item in cart', async () => {
        const response = await request(app).get(`/update/${testCartId}/NON-EXISTENT-SKU/1`);
        expect(response.status).toBe(404);
        expect(response.text).toBe('not in cart');
      });

      it('should update item quantity successfully', async () => {
        const response = await request(app).get(`/update/${testCartId}/${testSku}/3`);
        expect(response.status).toBe(200);
        expect(response.body.items[0].qty).toBe(3);
        expect(response.body.items[0].subtotal).toBe(30.00);
      });

      it('should remove item when quantity is 0', async () => {
        const response = await request(app).get(`/update/${testCartId}/${testSku}/0`);
        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(0);
      });
    });

    describe('POST /shipping/:id', () => {
      beforeEach(async () => {
        // Add an item to cart first
        await request(app).get(`/add/${testCartId}/${testSku}/1`);
      });

      it('should return 400 for missing shipping data', async () => {
        const response = await request(app)
          .post(`/shipping/${testCartId}`)
          .send({});
        expect(response.status).toBe(400);
        expect(response.text).toBe('shipping data missing');
      });

      it('should add shipping successfully', async () => {
        const shippingData = {
          distance: 10,
          cost: 5.00,
          location: 'Test Location'
        };

        const response = await request(app)
          .post(`/shipping/${testCartId}`)
          .send(shippingData);

        expect(response.status).toBe(200);
        expect(response.body.items).toContainEqual(expect.objectContaining({
          sku: 'SHIP',
          name: 'shipping to Test Location',
          price: 5.00,
          subtotal: 5.00
        }));
      });
    });

    describe('GET /rename/:from/:to', () => {
      const newCartId = 'test-cart-2';

      beforeEach(async () => {
        // Add an item to cart first
        await request(app).get(`/add/${testCartId}/${testSku}/1`);
      });

      it('should return 404 for non-existent cart', async () => {
        const response = await request(app).get(`/rename/non-existent/${newCartId}`);
        expect(response.status).toBe(404);
        expect(response.text).toBe('cart not found');
      });

      it('should rename cart successfully', async () => {
        const response = await request(app).get(`/rename/${testCartId}/${newCartId}`);
        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);

        // Verify old cart is gone
        const oldCartResponse = await request(app).get(`/cart/${testCartId}`);
        expect(oldCartResponse.status).toBe(404);

        // Verify new cart exists
        const newCartResponse = await request(app).get(`/cart/${newCartId}`);
        expect(newCartResponse.status).toBe(200);
        expect(newCartResponse.body.items).toHaveLength(1);
      });
    });
  });

  describe('Helper Functions', () => {
    describe('calcTotal', () => {
      it('should calculate total correctly', () => {
        const items = [
          { subtotal: 10.00 },
          { subtotal: 20.00 },
          { subtotal: 30.00 }
        ];
        const total = app.calcTotal(items);
        expect(total).toBe(60.00);
      });

      it('should return 0 for empty cart', () => {
        const total = app.calcTotal([]);
        expect(total).toBe(0);
      });
    });

    describe('calcTax', () => {
      it('should calculate tax correctly at 20%', () => {
        const tax = app.calcTax(120.00);
        expect(tax).toBe(20.00);
      });

      it('should return 0 for 0 total', () => {
        const tax = app.calcTax(0);
        expect(tax).toBe(0);
      });
    });
  });
}); 