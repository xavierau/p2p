# Payment Management API Documentation

## 🎉 What's New

### Advanced Filtering
The API now supports advanced filtering for Vendors and Items endpoints with flexible operators!

#### Vendors Endpoint (`/api/vendors`)
Filter vendors by ID or name with the following query parameters:

| Parameter | Description | Example Values |
|-----------|-------------|----------------|
| `id` | Filter by vendor ID | `1`, `2`, `3` |
| `idOperator` | Operator for ID filtering | `=` (exact match) |
| `name` | Filter by vendor name | `tech`, `TechCorp` |
| `nameOperator` | Operator for name filtering | `=` (exact), `contains` (fuzzy) |

**Examples:**
```bash
# Get all vendors
GET /api/vendors

# Get vendor with ID 1
GET /api/vendors?id=1&idOperator==

# Fuzzy search vendors with "tech" in name
GET /api/vendors?name=tech&nameOperator=contains

# Exact name match
GET /api/vendors?name=TechCorp&nameOperator==
```

#### Items Endpoint (`/api/items`)
Filter items by vendor ID or vendor name:

| Parameter | Description | Example Values |
|-----------|-------------|----------------|
| `vendorId` | Filter by vendor ID | `1`, `2`, `3` |
| `vendorIdOperator` | Operator for vendor ID | `=` (exact match) |
| `vendorName` | Filter by vendor name | `tech`, `TechCorp` |
| `vendorNameOperator` | Operator for vendor name | `=` (exact), `contains` (fuzzy) |

**Examples:**
```bash
# Get all items
GET /api/items

# Get items from vendor ID 1
GET /api/items?vendorId=1&vendorIdOperator==

# Fuzzy search items by vendor name containing "tech"
GET /api/items?vendorName=tech&vendorNameOperator=contains

# Exact vendor name match
GET /api/items?vendorName=TechCorp&vendorNameOperator==
```

## 📖 Interactive API Documentation

### View the Documentation
We've created a beautiful interactive API documentation page using Swagger UI!

**To view the documentation:**

1. Start the documentation server:
   ```bash
   node serve-docs.js
   ```

2. Open your browser and visit:
   ```
   http://localhost:8080
   ```

3. You'll see an interactive interface where you can:
   - Browse all API endpoints
   - See request/response schemas
   - Try out API calls directly from the browser
   - View filtering examples and usage

### Documentation Files

- **`api-docs.html`** - Interactive Swagger UI documentation page
- **`openapi.yaml`** - OpenAPI 3.0 specification file
- **`serve-docs.js`** - Simple HTTP server to serve the documentation
- **`postman_collection.json`** - Updated Postman collection with filtering examples

## 🧪 Testing with Postman

The Postman collection has been updated with new request examples:

### Vendors Folder
- List Vendors
- **Filter Vendors by ID** ⭐ NEW
- **Filter Vendors by Name (Fuzzy)** ⭐ NEW
- **Filter Vendors by Name (Exact)** ⭐ NEW
- Create Vendor

### Items Folder
- List Items
- **Filter Items by Vendor ID** ⭐ NEW
- **Filter Items by Vendor Name (Fuzzy)** ⭐ NEW
- **Filter Items by Vendor Name (Exact)** ⭐ NEW
- Create Item

Import the `postman_collection.json` file into Postman to test these endpoints!

## 🚀 Quick Start

1. **Start the API server:**
   ```bash
   cd server
   npm run dev
   ```

2. **Start the documentation server (in another terminal):**
   ```bash
   node serve-docs.js
   ```

3. **Login to get a token:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"password123"}'
   ```

4. **Test filtering (replace YOUR_TOKEN with the token from step 3):**
   ```bash
   # Fuzzy search vendors
   curl -X GET "http://localhost:3000/api/vendors?name=tech&nameOperator=contains" \
     -H "Authorization: Bearer YOUR_TOKEN"
   
   # Get items from specific vendor
   curl -X GET "http://localhost:3000/api/items?vendorId=1&vendorIdOperator==" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## 📝 Notes

- All name-based searches are **case-insensitive** for better user experience
- The `contains` operator performs fuzzy matching, perfect for search functionality
- Default operators: `idOperator` defaults to `=`, `nameOperator` defaults to `contains`
- Filters can be combined (e.g., filter by both ID and name)

## 🔗 Resources

- **API Base URL:** `http://localhost:3000/api`
- **Documentation URL:** `http://localhost:8080`
- **OpenAPI Spec:** `http://localhost:8080/openapi.yaml`

---

Happy coding! 🎉
